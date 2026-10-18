// GET/POST /api/reglas y POST /api/reglas/simular (§12, pantalla §13.4).

import { convertirReglas, monedaBase } from "@/dominio/dinero";
import type { Aprobador, Beneficiario, EntradaRegistro, Moneda, Reglas, TablaTasas } from "@/dominio/tipos";
import { evaluarEscenario, type ReporteEvaluacion } from "@/evaluacion/evaluar";
import { sinConfigurar } from "@/reglas/sin-configurar";
import type { Repositorio, ResumenVersion } from "@/repositorio/repositorio";

/** Set de prueba de `data/` para simular reglas cuando no hay escenario cargado (producción, #106). */
const SET_DE_PRUEBA = "lote-demo-oct";
/** Moneda de las tasas y montos del set de prueba. */
const MONEDA_SET_DE_PRUEBA: Moneda = "USD";

/** Una tasa y cuántas facturas del periodo la usaron. */
export type UsoTasa = { moneda: Moneda; tasa: string; facturas: number };

/** Lo que muestra la pantalla de reglas: versión vigente, historial y datos de apoyo. */
export type RespuestaReglas = {
  vigente: Reglas;
  historial: ResumenVersion[];
  beneficiarios: Beneficiario[];
  aprobadores: Aprobador[];
  tasas: TablaTasas | null;
  /** cuántas facturas del lote usaron cada tasa ("uso en el lote") */
  uso_tasas: UsoTasa[];
  /** #86: de dónde salieron las tasas (null = tabla fija del set de prueba) */
  tasas_origen: { fecha: string | null; fuente: string | null; estado: "hoy" | "anterior" | "ninguna" } | null;
};

/** Guardado rechazado; si fue por la simulación, trae el reporte para mostrarlo. */
export class ErrorReglas extends Error {
  constructor(
    readonly estado: 400 | 403 | 409,
    mensaje: string,
    readonly reporte?: ReporteEvaluacion,
  ) {
    super(mensaje);
    this.name = "ErrorReglas";
  }
}

/** Reglas sin el número de versión (lo asigna el repositorio al guardar). */
export function sinVersion(r: Reglas): Omit<Reglas, "version"> {
  const copia: Partial<Reglas> = { ...r };
  delete copia.version;
  return copia as Omit<Reglas, "version">;
}

/** Reglas vigentes, historial de versiones y tasas con su origen. */
export async function obtenerReglas(repo: Repositorio): Promise<RespuestaReglas> {
  const [datos, vigente, historial, esc, registro, vivas] = await Promise.all([
    repo.datosComunes(),
    repo.reglasVigentes(),
    repo.historialReglas(),
    repo.escenario(),
    repo.registro({ tipo: ["DECISION_AGENTE"] }),
    repo.tasasVigentes(),
  ]);
  // Producción (#86): las tasas del día; demo: la tabla fija del periodo del escenario.
  const tasas = vivas ? vivas.tabla : esc ? (datos.tasas[esc.config.periodo] ?? null) : null;
  const periodo = esc?.config.periodo;
  const uso_tasas: UsoTasa[] = Object.entries(tasas?.tasas ?? {})
    .filter(([m]) => m !== tasas?.base)
    .map(([m, tasa]) => ({
      moneda: m as Moneda,
      tasa: tasa ?? "",
      facturas: registro.filter((e) => e.monto_original?.moneda === m && (!periodo || e.momento.startsWith(periodo))).length,
    }));
  const tasas_origen = vivas ? { fecha: vivas.fecha, fuente: vivas.fuente, estado: vivas.estado } : null;
  return { vigente, historial, beneficiarios: datos.beneficiarios, aprobadores: datos.aprobadores, tasas, uso_tasas, tasas_origen };
}

/**
 * El set de prueba está en USD. Con otra moneda base el motor escalaría todo (reglas y tasas en monedas distintas) y la
 * simulación no diría nada (#149): se pasan los límites a USD con la tasa del día. Sin tasa se simulan tal cual: escala
 * todo y nunca paga, así que la guarda de «Guardar» sigue del lado seguro.
 */
async function enMonedaDelSet(repo: Repositorio, reglas: Reglas): Promise<Reglas> {
  const moneda = monedaBase(reglas);
  if (moneda === MONEDA_SET_DE_PRUEBA) return reglas;
  const vivas = await repo.tasasVigentes();
  const tasa = vivas?.tabla.base === moneda ? vivas.tabla.tasas[MONEDA_SET_DE_PRUEBA] : undefined;
  return tasa ? convertirReglas(reglas, MONEDA_SET_DE_PRUEBA, tasa) : reglas;
}

/**
 * Corre el lote del escenario con `reglas` sobre el historial previo al lote, sin registrar nada,
 * y compara con el esperado (§14, modo golden).
 */
export async function simularReglas(repo: Repositorio, reglas: Reglas): Promise<ReporteEvaluacion> {
  // La versión 0 (sin configurar, #106) escala todo: se simula como la versión 1 que se va a guardar.
  const candidata = sinConfigurar(reglas) ? { ...reglas, version: 1 } : reglas;
  const esc = await repo.escenario();
  // Producción no carga escenario (#106): se simula sobre el set de prueba de data/, el mismo del CI.
  if (!esc) return evaluarEscenario(SET_DE_PRUEBA, { extraccion: "golden", reglas: await enMonedaDelSet(repo, candidata) });
  return evaluarEscenario(esc.config.id, { extraccion: "golden", reglas: candidata, repo });
}

/**
 * Guarda una versión nueva. Antes la simula: si aprobaría algún pago fuera de reglas, se rechaza (409),
 * igual que el botón bloqueado de la pantalla (§13.4). Escribe CAMBIO_REGLAS en el registro.
 */
export async function guardarReglas(
  repo: Repositorio,
  nuevas: Omit<Reglas, "version">,
  autor: Aprobador,
  ahora: string,
): Promise<{ version: number; reporte: ReporteEvaluacion; entrada: EntradaRegistro }> {
  if (!autor.principal) throw new ErrorReglas(403, "Solo el aprobador principal puede guardar una versión nueva de las reglas.");
  return repo.enExclusiva(() => guardarEnExclusiva(repo, nuevas, autor, ahora));
}

async function guardarEnExclusiva(
  repo: Repositorio,
  nuevas: Omit<Reglas, "version">,
  autor: Aprobador,
  ahora: string,
): Promise<{ version: number; reporte: ReporteEvaluacion; entrada: EntradaRegistro }> {
  const actual = await repo.reglasVigentes();
  const candidata: Reglas = { ...nuevas, version: actual.version + 1, editada_por: autor.nombre, editada_en: ahora };
  const reporte = await simularReglas(repo, candidata);
  if (reporte.pagos_indebidos > 0) {
    throw new ErrorReglas(409, `Con estas reglas el agente aprobaría ${reporte.pagos_indebidos} pago(s) fuera de reglas en el set de prueba. No se guardó.`, reporte);
  }
  const version = await repo.guardarReglas(sinVersion(candidata));
  const entrada: EntradaRegistro = {
    id: await repo.siguienteIdRegistro(Number(ahora.slice(0, 4))),
    momento: ahora,
    actor: { tipo: "humano", aprobador_id: autor.id, nombre: autor.nombre },
    tipo: "CAMBIO_REGLAS",
    ref_interna: `CONFIG-REGLAS-V${version}`,
    factura_numero: null,
    beneficiario: null,
    canal: "carga_manual",
    formato: "xml",
    monto_original: null,
    monto_usd_centavos: null,
    tasa_usada: null,
    decision: null,
    reglas_version: version,
    evaluaciones: [],
    reglas_que_fallaron: [],
    comparaciones: [],
    explicacion: `${autor.nombre} guardó la versión ${version} de las reglas. Simulación: ${reporte.coinciden} de ${reporte.total} coinciden, ${reporte.pagos_indebidos} pagos fuera de reglas.`,
    comentario: null,
    entrada_origen: null,
    extraccion: null,
    sha256: null,
  };
  await repo.agregarEntrada(entrada);
  return { version, reporte, entrada };
}
