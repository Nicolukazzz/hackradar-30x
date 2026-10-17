// Evaluación del agente contra el esperado de un escenario (especificación §14).
// `evaluarLote` es el núcleo puro (lo usa "Simular" en la pantalla Reglas, #17); `evaluarEscenario`
// carga el escenario (de disco o del repositorio), arma la extracción golden o real y llama al núcleo.
// El CLI (`scripts/evaluar.ts`) y el informe en docs/research/ salen de `./cli` y `./informe`.

import { readdir } from "node:fs/promises";
import path from "node:path";

import { DIR_DATA_POR_DEFECTO } from "@/dominio/cargar";
import type { DecisionAgente, EntradaRegistro, IdRegla, Reglas, Trampa } from "@/dominio/tipos";
import { cacheEnDisco, type CacheExtraccion } from "@/extraccion/cache";
import { extraer } from "@/extraccion/extraer";
import type { ProveedorLLM } from "@/extraccion/llm/contrato";
import { proveedorDesdeEntorno } from "@/extraccion/llm/proveedor";
import { procesarLote, type DatosMotor } from "@/reglas/motor";
import type { Repositorio } from "@/repositorio/repositorio";

import { cargarGolden, type DocGolden } from "./escenario";
import { problemasExplicacion } from "./explicabilidad";

export type ModoExtraccion = "golden" | "real";

export const DECISIONES: readonly DecisionAgente[] = ["PAGAR", "FRENAR", "ESCALAR", "RECHAZADA_NO_FACTURA"];

export type ResultadoDocumento = {
  /** "documentos/011-omi-3381.eml", relativo a la carpeta del escenario */
  documento: string;
  ref_interna: string;
  factura_numero: string | null;
  beneficiario: string | null;
  trampa: Trampa[];
  esperado: DecisionAgente;
  obtenido: DecisionAgente;
  coincide: boolean;
  reglas_esperadas: IdRegla[];
  reglas_obtenidas: IdRegla[];
  explicacion: string;
  /** problemas de explicabilidad (§14); vacío = se entiende sin abrir código */
  problemas: string[];
};

export type ReporteEvaluacion = {
  escenario: string;
  modo: ModoExtraccion;
  reglas_version: number;
  total: number;
  coinciden: number;
  /** esperado ≠ PAGAR y obtenido = PAGAR. ≥ 1 es falla crítica: descalifica. Detalle: `pagosIndebidos()`. */
  pagos_indebidos: number;
  /** decisiones correctas que no son ESCALAR */
  autonomas: number;
  /** autonomas / total, 0..1 */
  autonomia: number;
  /** esperado PAGAR o FRENAR, obtenido ESCALAR. Detalle: `escaladosInnecesarios()`. */
  escalados_innecesarios: number;
  reglas_correctas: number;
  /** matriz[esperado][obtenido] = cuántos documentos */
  matriz: Record<DecisionAgente, Record<DecisionAgente, number>>;
  /** exactitud por trampa; los documentos sin trampa cuentan como "normal" */
  por_trampa: Record<string, { total: number; correctas: number }>;
  /** solo los documentos cuya explicación tiene algún problema */
  explicabilidad: { documento: string; problemas: string[] }[];
  documentos: ResultadoDocumento[];
};

export type ContextoEvaluacion = {
  escenario: string;
  modo: ModoExtraccion;
  datos: DatosMotor;
  reglas: Reglas;
  historial: readonly EntradaRegistro[];
  ahora: string;
  /** motor a evaluar; por defecto el real. Los tests inyectan uno saboteado. */
  motor?: typeof procesarLote;
};

export const esPagoIndebido = (d: ResultadoDocumento) => d.obtenido === "PAGAR" && d.esperado !== "PAGAR";
export const esEscaladoInnecesario = (d: ResultadoDocumento) =>
  d.obtenido === "ESCALAR" && (d.esperado === "PAGAR" || d.esperado === "FRENAR");

export const pagosIndebidos = (r: ReporteEvaluacion) => r.documentos.filter(esPagoIndebido);
export const escaladosInnecesarios = (r: ReporteEvaluacion) => r.documentos.filter(esEscaladoInnecesario);

function matrizVacia(): ReporteEvaluacion["matriz"] {
  const fila = () => Object.fromEntries(DECISIONES.map((d) => [d, 0])) as Record<DecisionAgente, number>;
  return Object.fromEntries(DECISIONES.map((d) => [d, fila()])) as ReporteEvaluacion["matriz"];
}

/** Corre el lote con `reglas` y compara cada decisión con el esperado del escenario. No registra nada. */
export function evaluarLote(docs: readonly DocGolden[], ctx: ContextoEvaluacion): ReporteEvaluacion {
  const { resultados, entradas } = (ctx.motor ?? procesarLote)(docs, ctx);
  const porRef = new Map(docs.map((d) => [d.doc.ref_interna, d]));
  const documentos = entradas.map((e, i): ResultadoDocumento => {
    const golden = porRef.get(e.ref_interna);
    const resultado = resultados[i];
    const obtenido = resultado?.decision ?? "ESCALAR";
    const esperado = golden?.esperado.decision ?? "ESCALAR";
    const reglas_obtenidas = resultado?.reglas_que_fallaron ?? [];
    const explicacion = resultado?.explicacion ?? e.explicacion;
    return {
      documento: golden?.esperado.documento ?? e.ref_interna,
      ref_interna: e.ref_interna,
      factura_numero: e.factura_numero,
      beneficiario: e.beneficiario,
      trampa: golden?.esperado.trampa ?? [],
      esperado,
      obtenido,
      coincide: obtenido === esperado,
      reglas_esperadas: golden?.esperado.reglas_que_fallan ?? [],
      reglas_obtenidas,
      explicacion,
      problemas: problemasExplicacion({ decision: obtenido, reglas: reglas_obtenidas, explicacion }),
    };
  });

  const matriz = matrizVacia();
  const por_trampa: ReporteEvaluacion["por_trampa"] = {};
  for (const d of documentos) {
    matriz[d.esperado][d.obtenido] += 1;
    for (const t of d.trampa.length > 0 ? d.trampa : ["normal"]) {
      const fila = (por_trampa[t] ??= { total: 0, correctas: 0 });
      fila.total += 1;
      if (d.coincide) fila.correctas += 1;
    }
  }

  const total = documentos.length;
  const autonomas = documentos.filter((d) => d.coincide && d.obtenido !== "ESCALAR").length;
  return {
    escenario: ctx.escenario,
    modo: ctx.modo,
    reglas_version: ctx.reglas.version,
    total,
    coinciden: documentos.filter((d) => d.coincide).length,
    pagos_indebidos: documentos.filter(esPagoIndebido).length,
    autonomas,
    autonomia: total === 0 ? 0 : autonomas / total,
    escalados_innecesarios: documentos.filter(esEscaladoInnecesario).length,
    reglas_correctas: documentos.filter((d) => d.reglas_obtenidas.join() === d.reglas_esperadas.join()).length,
    matriz,
    por_trampa,
    explicabilidad: documentos.filter((d) => d.problemas.length > 0).map((d) => ({ documento: d.documento, problemas: d.problemas })),
    documentos,
  };
}

export type OpcionesEvaluacion = {
  extraccion: ModoExtraccion;
  /** versión no guardada (pantalla Reglas); por defecto la del escenario o la vigente del repositorio */
  reglas?: Reglas;
  /** si viene, el escenario cargado en el repositorio (demo) en vez de leer `data/` */
  repo?: Repositorio;
  /** carpeta de datos; por defecto `data` */
  dir?: string;
  motor?: typeof procesarLote;
  /** modo real: LLM y caché; por defecto `LLM_PROVIDER` del entorno y `.cache/extraccion/` */
  llm?: ProveedorLLM;
  cache?: CacheExtraccion;
};

type Base = Omit<ContextoEvaluacion, "modo" | "motor"> & { docs: DocGolden[]; carpeta: string };

async function baseDesdeDisco(id: string, dir: string): Promise<Base> {
  const golden = await cargarGolden(id, dir);
  return {
    escenario: id,
    datos: golden.datos,
    reglas: golden.reglas,
    historial: golden.escenario.historial,
    ahora: golden.escenario.config.ahora,
    docs: golden.docs,
    carpeta: golden.escenario.carpeta,
  };
}

async function baseDesdeRepo(id: string, repo: Repositorio): Promise<Base> {
  const [esc, datos, registro, reglas, docs] = await Promise.all([
    repo.escenario(),
    repo.datosComunes(),
    repo.registro(),
    repo.reglasVigentes(),
    // El lote completo del escenario: los procesados y los que aún esperan.
    repo.documentosEscenario(),
  ]);
  if (!esc) throw new Error("No hay un escenario cargado para evaluar.");
  if (esc.config.id !== id) throw new Error(`El repositorio tiene cargado ${esc.config.id}, no ${id}.`);
  // Solo el historial previo al lote: lo que el agente decidió después no puede influir en la simulación.
  return { escenario: id, datos, reglas, historial: registro.slice(0, esc.entradas_importadas), ahora: esc.config.ahora, docs, carpeta: esc.carpeta };
}

/**
 * Modo real (§14): cada documento pasa por `extraer` (#4, parser + LLM con caché).
 * Hasta que exista `ingerir` (#11), el `DocumentoRecibido` es el mismo del modo golden
 * (ref, sha256 y remitente→beneficiario calculados igual que la ingesta).
 */
async function conExtraccionReal(base: Base, reglas: Reglas, opciones: OpcionesEvaluacion): Promise<DocGolden[]> {
  const llm = opciones.llm ?? proveedorDesdeEntorno();
  const cache = opciones.cache ?? cacheEnDisco();
  const docs: DocGolden[] = [];
  for (const d of base.docs) {
    const ext = await extraer(d.doc, { llm, cache, dirBase: base.carpeta, confianzaMinima: reglas.extraccion.confianza_minima });
    docs.push({ ...d, ext });
  }
  return docs;
}

export async function evaluarEscenario(id: string, opciones: OpcionesEvaluacion): Promise<ReporteEvaluacion> {
  const base = opciones.repo ? await baseDesdeRepo(id, opciones.repo) : await baseDesdeDisco(id, opciones.dir ?? DIR_DATA_POR_DEFECTO);
  const reglas = opciones.reglas ?? base.reglas;
  const docs = opciones.extraccion === "real" ? await conExtraccionReal(base, reglas, opciones) : base.docs;
  return evaluarLote(docs, { ...base, reglas, modo: opciones.extraccion, motor: opciones.motor });
}

/** Ids de los escenarios de `data/escenarios/`, en orden alfabético. */
export async function listarEscenarios(dir: string = DIR_DATA_POR_DEFECTO): Promise<string[]> {
  const entradas = await readdir(path.join(dir, "escenarios"), { withFileTypes: true });
  return entradas.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}
