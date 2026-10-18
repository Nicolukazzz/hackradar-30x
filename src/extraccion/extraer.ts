// Orquesta la extracción (§8 paso 4): parser sin IA → LLM solo para lo que falte → Extraccion.
// No decide nada: entrega datos con su confianza; R1 y R10 (motor, #5) deciden con ellos.

import type { Campo, DocumentoRecibido, Extraccion } from "@/dominio/tipos";
import { normalizarTexto } from "@/dominio/normalizar";

import { claveCache, type CacheExtraccion } from "./cache";
import type { ProveedorLLM } from "./llm/contrato";
import { normalizarDocumento, textoCrudo } from "./normalizar";
import { parsearChat } from "./parsers/chat";
import { parsearPdf } from "./parsers/pdf-texto";
import { parsearXmlFactura } from "./parsers/xml-factura";
import {
  CAMPOS_OBLIGATORIOS,
  CAMPOS_OPCIONALES,
  NOMBRES_CAMPOS,
  type DocumentoNormalizado,
  type ExtraccionParcial,
  type NombreCampo,
} from "./tipos";

/** Lo que necesita `extraer`: el lector LLM (o `ninguno`), caché opcional y el umbral de R1. */
export type DependenciasExtraccion = {
  llm: ProveedorLLM;
  cache?: CacheExtraccion;
  /** carpeta contra la que se resuelven las rutas de los adjuntos (escenario del dataset) */
  dirBase?: string;
  /** umbral de R1 (reglas.extraccion.confianza_minima); por defecto 0,90 */
  confianzaMinima?: number;
};

/** Confianza que queda cuando parser y LLM no coinciden en un campo: obliga a R1 a escalar. */
export const CONFIANZA_DISCREPANCIA = 0.5;

/** Doble lectura (#58): confianza de un campo en el que coinciden 2 de los 3 lectores (parser, LLM A, LLM B). */
export const CONFIANZA_DOS_DE_TRES = 0.92;

function mismoValor(a: unknown, b: unknown): boolean {
  if (typeof a === "string" && typeof b === "string") {
    const limpio = (s: string) => normalizarTexto(s).replace(/\s+/g, " ").trim();
    return limpio(a) === limpio(b);
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Cruza dos lecturas del mismo campo. Gana `principal`; si coinciden, la mayor confianza (salvo que
 * `principal` ya viniera marcado como ambiguo: coincidir con una de sus opciones no lo desambigua);
 * si discrepan, confianza ≤ 0,5 para que R1 escale.
 */
function cruzar(principal: Campo<unknown> | undefined, otra: Campo<unknown> | undefined): Campo<unknown> | undefined {
  if (!otra || otra.valor === null) return principal;
  if (!principal || principal.valor === null) return otra;
  if (!mismoValor(principal.valor, otra.valor)) {
    return { ...principal, confianza: Math.min(principal.confianza, otra.confianza, CONFIANZA_DISCREPANCIA) };
  }
  if (principal.confianza <= CONFIANZA_DISCREPANCIA) return principal;
  return { ...principal, confianza: Math.max(principal.confianza, otra.confianza) };
}

function cruzarParciales(principal: ExtraccionParcial, otra: ExtraccionParcial, campos: readonly NombreCampo[]): ExtraccionParcial {
  const r: ExtraccionParcial = { ...principal };
  for (const k of campos) {
    const c = cruzar(principal[k] as Campo<unknown> | undefined, otra[k] as Campo<unknown> | undefined);
    if (c) (r as Record<string, unknown>)[k] = c;
  }
  return r;
}

const CAMPOS_DE_DATOS = NOMBRES_CAMPOS.filter((k) => k !== "es_factura");

/**
 * Parser sin IA. Fuente principal: XML > adjunto con texto > mensaje (chat o cuerpo sin adjunto).
 * Las demás fuentes del mismo documento se cruzan con la principal: un cuerpo de correo que dice
 * "paguen a la cuenta …9083" mientras el PDF dice •••• 5530 deja la cuenta en ≤ 0,5 y R1 escala.
 */
export function parsearSinIa(n: DocumentoNormalizado): ExtraccionParcial {
  const fuentes: ExtraccionParcial[] = [];
  if (n.xml) fuentes.push(parsearXmlFactura(n.xml));
  if (n.lineas_adjuntos.length > 0) fuentes.push(parsearPdf(n.lineas_adjuntos));
  if (n.texto_mensaje) {
    const mensaje = parsearChat(n.texto_mensaje);
    // El mensaje que acompaña un adjunto no opina sobre si el adjunto es factura.
    if (fuentes.length > 0 || n.visuales.length > 0) delete mensaje.es_factura;
    fuentes.push(mensaje);
  }
  const [principal = {}, ...resto] = fuentes;
  let r = principal;
  for (const otra of resto) r = { ...cruzarParciales(r, otra, CAMPOS_DE_DATOS), idioma: r.idioma ?? otra.idioma };
  // Si hay una imagen o un PDF escaneado, el texto que lo acompaña no basta para decir "no es factura".
  if (n.visuales.length > 0 && r.es_factura?.valor === false) delete r.es_factura;
  return r;
}

function camposPorConsultar(p: ExtraccionParcial, minima: number): NombreCampo[] {
  const bajo = (k: NombreCampo) => (p[k]?.confianza ?? 0) < minima || p[k]?.valor === null;
  if (p.es_factura?.valor === false && !bajo("es_factura")) return []; // claramente no es factura
  const obligatorios = (["es_factura", ...CAMPOS_OBLIGATORIOS] as NombreCampo[]).filter(bajo);
  if (obligatorios.length === 0) return [];
  // Ya que se llama al LLM, también se piden los opcionales que el parser no vio.
  return [...obligatorios, ...CAMPOS_OPCIONALES.filter((k) => p[k] === undefined)];
}

/** Respuesta con al menos un dato o una señal: las vacías (bloqueo, JSON inválido) no se cachean. */
function aportaAlgo(p: ExtraccionParcial): boolean {
  return NOMBRES_CAMPOS.some((k) => p[k] !== undefined) || (p.instrucciones_sospechosas?.length ?? 0) > 0;
}

async function consultarLlm(
  n: DocumentoNormalizado,
  faltantes: NombreCampo[],
  deps: DependenciasExtraccion,
  llm: ProveedorLLM = deps.llm,
): Promise<ExtraccionParcial> {
  const clave = deps.cache ? claveCache(n, faltantes, `${llm.nombre}:${llm.modelo ?? ""}`) : null;
  if (clave && deps.cache) {
    const guardado = await deps.cache.leer(clave);
    if (guardado) return guardado;
  }
  const r = await llm.extraer(n, faltantes);
  // Solo se cachea una respuesta real con contenido: si no hubo LLM o vino vacía, la próxima corrida reintenta.
  if (clave && deps.cache && r.proveedor_llm && r.proveedor_llm !== "ninguno" && aportaAlgo(r)) {
    await deps.cache.guardar(clave, r).catch(() => undefined); // una caché que no escribe no detiene la extracción
  }
  return r;
}

/**
 * Doble lectura (#58), un campo: vale solo si coinciden al menos 2 de los 3 lectores. El parser vota solo si no
 * marcó el campo como ambiguo (≤ 0,5: coincidir con una de sus opciones no lo desambigua). Sin 2 que coincidan, el
 * primer valor disponible con confianza ≤ 0,5: R1 escala.
 */
export function votar(
  parser: Campo<unknown> | undefined,
  a: Campo<unknown> | undefined,
  b: Campo<unknown> | undefined,
  confianzaAcuerdo = CONFIANZA_DOS_DE_TRES,
): Campo<unknown> | undefined {
  const p = parser && parser.valor !== null && parser.confianza > CONFIANZA_DISCREPANCIA ? parser : undefined;
  const llmA = a?.valor !== null ? a : undefined;
  const llmB = b?.valor !== null ? b : undefined;
  if (llmA && llmB && mismoValor(llmA.valor, llmB.valor)) return { ...llmA, confianza: confianzaAcuerdo };
  for (const l of [llmA, llmB]) if (p && l && mismoValor(p.valor, l.valor)) return { ...p, confianza: Math.max(p.confianza, confianzaAcuerdo) };
  const unico = parser?.valor !== null && parser ? parser : (llmA ?? llmB);
  return unico ? { ...unico, confianza: Math.min(unico.confianza, CONFIANZA_DISCREPANCIA) } : undefined;
}

const vacio = (): Campo<never> => ({ valor: null, confianza: 0, fuente: "parser" });

/**
 * Documento recibido → `Extraccion`. Lee primero sin IA; consulta al LLM solo por los campos que quedaron bajo el
 * umbral y solo puede aportar esos. Con doble lectura, un campo vale si coinciden 2 de 3 lectores. Nunca lanza por un
 * adjunto ilegible: deja el campo vacío y R1 escala.
 */
export async function extraer(doc: DocumentoRecibido, deps: DependenciasExtraccion): Promise<Extraccion> {
  const minima = deps.confianzaMinima ?? 0.9;
  const n = await normalizarDocumento(doc, { dirBase: deps.dirBase });
  const parser = parsearSinIa(n);
  const faltantes = camposPorConsultar(parser, minima);
  const lectores = deps.llm.lectores;
  // Doble lectura (#58): los dos lectores en paralelo y se cruzan (2 de 3). Si uno falla del todo, nada llega a 2 de 3 y
  // escala: nunca se paga con una sola lectura. Se guarda qué hizo cada lector para que la traza diga cuál falló y por qué.
  let estadoLectores: NonNullable<Extraccion["senales_llm"]["lectores"]> | undefined;
  let llm: ExtraccionParcial = {};
  let otro: ExtraccionParcial | null = null;
  if (faltantes.length > 0 && lectores) {
    const lecturas = await Promise.all(
      lectores.map((l) =>
        consultarLlm(n, faltantes, deps, l).then(
          (r): { nombre: string; r: ExtraccionParcial; error: string | null } => ({ nombre: l.nombre, r, error: r.fallo ?? null }),
          (e: unknown) => ({ nombre: l.nombre, r: { sin_respuesta: true } as ExtraccionParcial, error: e instanceof Error ? e.message : String(e) }),
        ),
      ),
    );
    const usables = lecturas.filter((x) => aportaAlgo(x.r));
    estadoLectores = lecturas.map((x) => {
      if (aportaAlgo(x.r)) return { proveedor: x.nombre, estado: "leyo" as const };
      if (x.r.sin_respuesta) return { proveedor: x.nombre, estado: "fallo" as const, ...(x.error ? { detalle: x.error } : {}) };
      return { proveedor: x.nombre, estado: "vacio" as const, detalle: "respuesta vacía o que no cumple el formato" };
    });
    // Orden de los lectores: el que leyó va primero (sus señales de R10 e idioma cuentan igual).
    const [a = {}, b = {}] = [...usables.map((x) => x.r), ...lecturas.filter((x) => !aportaAlgo(x.r)).map((x) => x.r)];
    [llm, otro] = [a, b];
  } else if (faltantes.length > 0) {
    llm = await consultarLlm(n, faltantes, deps);
  }
  // 2 de 3 da al menos el umbral de R1 (si el umbral sube por encima de 0,95, ni el acuerdo alcanza: escala).
  const acuerdo = Math.min(0.95, Math.max(CONFIANZA_DOS_DE_TRES, minima));

  const ext: Extraccion = {
    es_factura: vacio(),
    beneficiario_nombre: vacio(),
    numero: vacio(),
    monto_total: vacio(),
    fecha_emision: vacio(),
    fecha_vencimiento: vacio(),
    cuenta_destino_ultimos4: vacio(),
    concepto: vacio(),
    idioma: parser.idioma ?? llm.idioma ?? otro?.idioma ?? "es",
    texto_crudo: textoCrudo(n),
    // Señales de R10 de cualquiera de los dos lectores cuentan.
    senales_llm: {
      instrucciones_sospechosas: [...new Set([...(llm.instrucciones_sospechosas ?? []), ...(otro?.instrucciones_sospechosas ?? [])])],
      // Hacía falta el LLM y ningún lector respondió (#103). Solo se escribe cuando pasa, así las demás extracciones no cambian.
      ...(faltantes.length > 0 && llm.sin_respuesta && (otro === null || otro.sin_respuesta) ? { sin_respuesta: true } : {}),
      ...(estadoLectores ? { lectores: estadoLectores } : {}),
    },
    proveedor_llm: faltantes.length > 0 ? (llm.proveedor_llm ?? otro?.proveedor_llm ?? "ninguno") : "ninguno",
  };
  for (const k of NOMBRES_CAMPOS) {
    const p = parser[k] as Campo<unknown> | undefined;
    // El LLM solo puede aportar los campos que se le pidieron.
    const pedido = faltantes.includes(k);
    const c = !pedido ? p : otro ? votar(p, llm[k] as Campo<unknown> | undefined, otro[k] as Campo<unknown> | undefined, acuerdo) : cruzar(p, llm[k] as Campo<unknown> | undefined);
    if (c) (ext as Record<string, unknown>)[k] = c;
  }
  return ext;
}
