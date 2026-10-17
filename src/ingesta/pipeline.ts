// Pipeline por documento (§8 pasos 3–7): ya ingerido (ref, hash, remitente) → extracción → motor →
// registro. Devuelve la entrada para que el canal le responda al remitente (respuesta.ts).

import type { DocumentoRecibido, EntradaRegistro, Extraccion } from "@/dominio/tipos";
import type { DependenciasExtraccion } from "@/extraccion/extraer";
import { facturasVigentes } from "@/reglas/libro";
import { procesarLote } from "@/reglas/motor";
import type { Repositorio } from "@/repositorio/repositorio";

/** Lee el documento y devuelve su extracción. Por defecto `extraer` (#4); la demo y los tests inyectan la golden. */
export type Extractor = (doc: DocumentoRecibido) => Promise<Extraccion>;

export type DependenciasPipeline = {
  repo: Repositorio;
  /** momento de la decisión (`ahora` del motor) */
  ahora: string;
  extractor: Extractor;
};

/** Extractor real: parser sin IA → LLM solo para lo que falte (#4). */
export function extractorReal(deps: DependenciasExtraccion): Extractor {
  return async (doc) => {
    const { extraer } = await import("@/extraccion/extraer");
    return extraer(doc, deps);
  };
}

/**
 * §8 paso 3: si este mismo archivo ya se pagó, está aprobado o espera aprobación, no se extrae de nuevo
 * (no se gasta LLM): se reusa lo que se extrajo la primera vez. Mismo archivo ⇒ mismos datos, y R2 lo
 * frena por el criterio "mismo archivo" (R2 lo aplica aunque no haya nombre legible). Si la entrada previa
 * no guardó extracción (historial importado), se arma una mínima con emisor y número.
 */
function extraccionDelArchivoRepetido(doc: DocumentoRecibido, historial: readonly EntradaRegistro[]): Extraccion | null {
  if (!doc.sha256) return null;
  const previa = facturasVigentes(historial).find((f) => f.sha256 === doc.sha256);
  if (!previa) return null;
  const entrada = historial.find((e) => e.id === previa.id);
  return entrada?.extraccion ? structuredClone(entrada.extraccion) : extraccionMinima(doc, entrada ?? null);
}

/** Extracción con solo lo que dice la entrada previa (o nada): lo que falta queda en confianza 0 y R1 escala. */
function extraccionMinima(doc: DocumentoRecibido, entrada: EntradaRegistro | null): Extraccion {
  const dato = <T,>(valor: T | null) => ({ valor, confianza: valor === null ? 0 : 1, fuente: "parser" as const });
  return {
    es_factura: { valor: true, confianza: entrada ? 1 : 0, fuente: "parser" },
    beneficiario_nombre: dato(entrada?.beneficiario ?? null),
    numero: dato(entrada?.factura_numero ?? null),
    monto_total: dato(entrada?.monto_original ?? null),
    fecha_emision: dato(null),
    fecha_vencimiento: dato(null),
    cuenta_destino_ultimos4: dato(null),
    concepto: dato(null),
    idioma: "es",
    texto_crudo: [doc.asunto, doc.texto_mensaje].filter(Boolean).join("\n"),
    senales_llm: { instrucciones_sospechosas: [] },
    proveedor_llm: "ninguno",
  };
}

/**
 * Si el extractor falla (LLM caído, archivo ilegible), el documento igual recibe decisión: extracción vacía
 * con confianza 0 → R1 escala. Fallar hacia seguro (§5 paso 4), nunca dejar un documento sin decisión.
 */
async function extraerSinFallar(extractor: Extractor, doc: DocumentoRecibido): Promise<Extraccion> {
  try {
    return await extractor(doc);
  } catch {
    return extraccionMinima(doc, null);
  }
}

/** Procesa un documento ya ingerido y agrega su DECISION_AGENTE al registro. Ya procesado → error. */
export async function procesarDocumento(ref: string, deps: DependenciasPipeline): Promise<EntradaRegistro> {
  const { repo } = deps;
  const doc = await repo.documento(ref);
  if (!doc) throw new Error(`No existe el documento ${ref}: primero ingerir().`);

  // Extraer fuera de la exclusiva (puede tardar segundos con LLM); decidir y registrar dentro, con el historial al día.
  // Dos envíos simultáneos del mismo archivo pueden extraer los dos (se pierde el ahorro), pero R2 frena el segundo dentro.
  const previo = await repo.registro();
  const ext = extraccionDelArchivoRepetido(doc, previo) ?? (await extraerSinFallar(deps.extractor, doc));

  return repo.enExclusiva(async () => {
    const [datos, reglas, historial] = await Promise.all([repo.datosComunes(), repo.reglasVigentes(), repo.registro()]);
    if (historial.some((e) => e.tipo === "DECISION_AGENTE" && e.ref_interna === ref)) {
      throw new Error(`El documento ${ref} ya tiene decisión del agente.`);
    }
    // Lote de uno: mismo motor, presupuesto y ids que "Procesar facturas nuevas".
    const { entradas } = procesarLote([{ doc, ext }], { datos, reglas, historial, ahora: deps.ahora });
    const entrada = entradas[0];
    if (!entrada) throw new Error(`El motor no devolvió decisión para ${ref}.`);
    await repo.agregarEntrada(entrada);
    return entrada;
  });
}
