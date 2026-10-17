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

async function consultarLlm(n: DocumentoNormalizado, faltantes: NombreCampo[], deps: DependenciasExtraccion): Promise<ExtraccionParcial> {
  const clave = deps.cache ? claveCache(n, faltantes, `${deps.llm.nombre}:${deps.llm.modelo ?? ""}`) : null;
  if (clave && deps.cache) {
    const guardado = await deps.cache.leer(clave);
    if (guardado) return guardado;
  }
  const r = await deps.llm.extraer(n, faltantes);
  // Solo se cachea una respuesta real con contenido: si no hubo LLM o vino vacía, la próxima corrida reintenta.
  if (clave && deps.cache && r.proveedor_llm && r.proveedor_llm !== "ninguno" && aportaAlgo(r)) {
    await deps.cache.guardar(clave, r).catch(() => undefined); // una caché que no escribe no detiene la extracción
  }
  return r;
}

const vacio = (): Campo<never> => ({ valor: null, confianza: 0, fuente: "parser" });

export async function extraer(doc: DocumentoRecibido, deps: DependenciasExtraccion): Promise<Extraccion> {
  const minima = deps.confianzaMinima ?? 0.9;
  const n = await normalizarDocumento(doc, { dirBase: deps.dirBase });
  const parser = parsearSinIa(n);
  const faltantes = camposPorConsultar(parser, minima);
  const llm: ExtraccionParcial = faltantes.length > 0 ? await consultarLlm(n, faltantes, deps) : {};

  const ext: Extraccion = {
    es_factura: vacio(),
    beneficiario_nombre: vacio(),
    numero: vacio(),
    monto_total: vacio(),
    fecha_emision: vacio(),
    fecha_vencimiento: vacio(),
    cuenta_destino_ultimos4: vacio(),
    concepto: vacio(),
    idioma: parser.idioma ?? llm.idioma ?? "es",
    texto_crudo: textoCrudo(n),
    senales_llm: { instrucciones_sospechosas: llm.instrucciones_sospechosas ?? [] },
    proveedor_llm: faltantes.length > 0 ? (llm.proveedor_llm ?? "ninguno") : "ninguno",
  };
  for (const k of NOMBRES_CAMPOS) {
    // El LLM solo puede aportar los campos que se le pidieron.
    const c = cruzar(parser[k] as Campo<unknown> | undefined, faltantes.includes(k) ? (llm[k] as Campo<unknown> | undefined) : undefined);
    if (c) (ext as Record<string, unknown>)[k] = c;
  }
  return ext;
}
