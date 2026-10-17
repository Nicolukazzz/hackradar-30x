// Arma la entrada del motor en modo "golden" (§14): documentos del escenario + extraccion_esperada.
// Lo usan la API (#17: procesar el lote demo y simular reglas) y la evaluación (#7).

import { cargarDatosComunes, cargarEscenario, type DatosComunes, reglasVersion, type Escenario } from "@/dominio/cargar";
import type { Campo, DocumentoRecibido, EsperadoDocumento, Extraccion, ExtraccionPlana, Reglas } from "@/dominio/tipos";
import { recibir } from "@/ingesta/ingerir";

export type DocGolden = { doc: DocumentoRecibido; ext: Extraccion; esperado: EsperadoDocumento };

export type EscenarioGolden = {
  datos: DatosComunes;
  escenario: Escenario;
  reglas: Reglas;
  docs: DocGolden[];
};

function campo<T>(valor: T | null, confianza = 1): Campo<T> {
  return { valor, confianza, fuente: "parser" };
}

/** ExtraccionPlana (esperado.json) → Extraccion con confianza 1 en cada campo. */
export function extraccionDesdePlana(plana: ExtraccionPlana, texto_crudo: string): Extraccion {
  const ext: Extraccion = {
    es_factura: campo(plana.es_factura),
    beneficiario_nombre: campo(plana.beneficiario_nombre),
    numero: campo(plana.numero),
    monto_total: campo(plana.monto_total),
    fecha_emision: campo(plana.fecha_emision),
    fecha_vencimiento: campo(plana.fecha_vencimiento),
    cuenta_destino_ultimos4: campo(plana.cuenta_destino_ultimos4),
    concepto: campo(plana.concepto),
    idioma: plana.idioma,
    texto_crudo,
    senales_llm: { instrucciones_sospechosas: [] },
    proveedor_llm: "ninguno",
  };
  if (plana.subtotal) ext.subtotal = campo(plana.subtotal);
  if (plana.impuestos) ext.impuestos = campo(plana.impuestos);
  if (plana.referencia_acuerdo) ext.referencia_acuerdo = campo(plana.referencia_acuerdo);
  if (plana.hito_numero !== undefined) ext.hito_numero = campo(plana.hito_numero);
  return ext;
}

/** Datos, escenario y reglas sin los documentos (repositorio con lote vacío: entran por la ingesta). */
export async function cargarSinDocumentos(id: string, dir?: string): Promise<EscenarioGolden> {
  const [datos, escenario] = await Promise.all([cargarDatosComunes(dir), cargarEscenario(id, dir)]);
  return { datos, escenario, reglas: reglasVersion(datos, escenario.config.reglas_version), docs: [] };
}

export async function cargarGolden(id: string, dir?: string): Promise<EscenarioGolden> {
  const [datos, escenario] = await Promise.all([cargarDatosComunes(dir), cargarEscenario(id, dir)]);
  const docs = await Promise.all(
    escenario.documentos.map(async (meta): Promise<DocGolden> => {
      const { archivo_original, ...entrante } = meta;
      const esperado = escenario.esperado.find((e) => e.documento === archivo_original);
      if (!esperado) throw new Error(`sin esperado para ${archivo_original}`);
      // Mismo DocumentoRecibido que produce la ingesta (#11), con la ref que espera el escenario.
      const { doc } = await recibir(entrante, esperado.ref_esperada, datos.beneficiarios, escenario.carpeta);
      const texto = [meta.asunto, meta.texto_mensaje].filter(Boolean).join("\n");
      return { doc, ext: extraccionDesdePlana(esperado.extraccion_esperada, texto), esperado };
    }),
  );
  return { datos, escenario, reglas: reglasVersion(datos, escenario.config.reglas_version), docs };
}
