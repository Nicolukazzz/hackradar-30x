// GET /api/bandeja (§12, pantalla §13.1): KPIs, presupuesto del periodo y filas del lote.

import { normalizarNombre, normalizarTexto } from "@/dominio/normalizar";
import type { Canal, DecisionAgente, Dinero, EntradaRegistro, Formato, IdRegla } from "@/dominio/tipos";
import { facturasVigentes, periodoDe, totalEn } from "@/reglas/libro";
import type { Repositorio } from "@/repositorio/repositorio";

import { descripcionBeneficiario, entradasDelLote, estadoActual, type EstadoFactura } from "./comun";

export type FiltroDecision = "todas" | "pagar" | "frenar" | "escalar";

export type FilaBandeja = {
  ref_interna: string;
  factura_numero: string | null;
  canal: Canal;
  formato: Formato;
  recibido_en: string;
  beneficiario: string | null;
  /** "Colombia · contratista" · "nuevo" */
  beneficiario_detalle: string;
  monto_original: Dinero | null;
  monto_usd_centavos: number | null;
  /** lo que decidió el agente */
  decision: DecisionAgente;
  /** lo que ve la persona hoy: la decisión del agente o la resolución humana */
  estado: EstadoFactura;
  explicacion: string;
  reglas_que_fallaron: IdRegla[];
  comparaciones: string[];
};

export type ConteoMonto = { n: number; usd_centavos: number };

export type RespuestaBandeja = {
  /** id del periodo de presupuesto (periodoDe: "2026-10" · "2026-10-Q2" · "2026-T4") */
  periodo: string;
  /** mes calendario del lote, para mostrar ("2026-10") */
  mes: string;
  /** cuándo decidió el agente (null si aún no hay lote) */
  procesado_en: string | null;
  /** documentos del escenario que esperan "Procesar facturas nuevas" */
  por_procesar: number;
  kpis: {
    total: number;
    /** con respuesta esperada en el set de prueba */
    con_esperado: number;
    coinciden: number;
    pagos_fuera_de_reglas: number;
    autonomas: number;
    /** 0..1 */
    autonomia: number;
    pagadas: ConteoMonto;
    frenadas: ConteoMonto;
    escaladas: ConteoMonto;
    /** escaladas que todavía esperan a una persona (sin resolución humana final) */
    escaladas_pendientes: number;
    rechazadas_no_factura: number;
  };
  presupuesto: {
    monto_usd: number;
    pagado_antes: number;
    pagado_en_lote: number;
    reservado: number;
    disponible: number;
  };
  conteos: Record<FiltroDecision, number>;
  filas: FilaBandeja[];
};

const FILTRO: Record<Exclude<FiltroDecision, "todas">, DecisionAgente> = { pagar: "PAGAR", frenar: "FRENAR", escalar: "ESCALAR" };

function suma(lote: EntradaRegistro[], d: DecisionAgente): ConteoMonto {
  const de = lote.filter((e) => e.decision === d);
  return { n: de.length, usd_centavos: de.reduce((s, e) => s + (e.monto_usd_centavos ?? 0), 0) };
}

export async function obtenerBandeja(repo: Repositorio, opciones: { decision?: FiltroDecision; q?: string } = {}): Promise<RespuestaBandeja> {
  const [{ registro, lote }, esc, reglas, datos, pendientes] = await Promise.all([
    entradasDelLote(repo),
    repo.escenario(),
    repo.reglasVigentes(),
    repo.datosComunes(),
    repo.pendientes(),
  ]);
  const ahora = esc?.config.ahora ?? lote.at(-1)?.momento ?? "";
  const tipo = reglas.presupuesto.periodo;
  // El periodo de presupuesto sale del tipo de las reglas vigentes (mensual, quincenal o trimestral), no del escenario.
  const periodo = periodoDe(ahora, tipo);

  // Presupuesto (§6): lo pagado antes del lote sale del historial importado; el resto, del lote y sus resoluciones.
  const importadas = new Set(registro.slice(0, esc?.entradas_importadas ?? 0).map((e) => e.id));
  const vigentes = facturasVigentes(registro);
  const antes = vigentes.filter((f) => importadas.has(f.id));
  const delLote = vigentes.filter((f) => !importadas.has(f.id));
  const pagado_antes = totalEn(antes, periodo, tipo, "pagada");
  const pagado_en_lote = totalEn(delLote, periodo, tipo, "pagada");
  const reservado = reglas.presupuesto.contar_escalado_como_reservado
    ? totalEn(antes, periodo, tipo, "reservada") + totalEn(delLote, periodo, tipo, "reservada")
    : 0;

  // KPIs contra el esperado del escenario (§14): solo la decisión del agente, no la humana.
  const esperado = new Map((esc?.esperado ?? []).map((e) => [e.ref_esperada, e.decision]));
  const conEsperado = lote.filter((e) => esperado.has(e.ref_interna));
  const coinciden = conEsperado.filter((e) => esperado.get(e.ref_interna) === e.decision).length;
  const pagos_fuera_de_reglas = conEsperado.filter((e) => e.decision === "PAGAR" && esperado.get(e.ref_interna) !== "PAGAR").length;
  const autonomas = conEsperado.filter((e) => e.decision !== "ESCALAR" && esperado.get(e.ref_interna) === e.decision).length;

  const porNombre = new Map(datos.beneficiarios.map((b) => [normalizarNombre(b.nombre), b]));
  const todas: FilaBandeja[] = lote.map((e) => {
    const b = e.beneficiario ? (porNombre.get(normalizarNombre(e.beneficiario)) ?? null) : null;
    return {
      ref_interna: e.ref_interna,
      factura_numero: e.factura_numero,
      canal: e.canal,
      formato: e.formato,
      recibido_en: e.momento,
      beneficiario: e.beneficiario,
      beneficiario_detalle: descripcionBeneficiario(b, null),
      monto_original: e.monto_original,
      monto_usd_centavos: e.monto_usd_centavos,
      decision: e.decision as DecisionAgente,
      estado: estadoActual(registro, e).estado,
      explicacion: e.explicacion,
      reglas_que_fallaron: e.reglas_que_fallaron,
      comparaciones: e.comparaciones,
    };
  });

  const q = normalizarTexto(opciones.q ?? "").trim();
  const filtro = opciones.decision && opciones.decision !== "todas" ? FILTRO[opciones.decision] : null;
  // La búsqueda filtra primero; los conteos de las pestañas siguen a la búsqueda.
  const buscadas = todas.filter((f) => !q || normalizarTexto(`${f.factura_numero ?? ""} ${f.beneficiario ?? ""} ${f.ref_interna}`).includes(q));
  const filas = buscadas.filter((f) => !filtro || f.decision === filtro);

  return {
    periodo,
    mes: (esc?.config.ahora ?? ahora).slice(0, 7),
    procesado_en: lote.length > 0 ? ahora : null,
    por_procesar: pendientes.length,
    kpis: {
      total: lote.length,
      con_esperado: conEsperado.length,
      coinciden,
      pagos_fuera_de_reglas,
      autonomas,
      autonomia: lote.length === 0 ? 0 : autonomas / lote.length,
      pagadas: suma(lote, "PAGAR"),
      frenadas: suma(lote, "FRENAR"),
      escaladas: suma(lote, "ESCALAR"),
      escaladas_pendientes: todas.filter((f) => f.estado === "ESCALAR").length,
      rechazadas_no_factura: lote.filter((e) => e.decision === "RECHAZADA_NO_FACTURA").length,
    },
    presupuesto: {
      monto_usd: reglas.presupuesto.monto_usd,
      pagado_antes,
      pagado_en_lote,
      reservado,
      disponible: reglas.presupuesto.monto_usd - pagado_antes - pagado_en_lote - reservado,
    },
    conteos: {
      todas: buscadas.length,
      pagar: buscadas.filter((f) => f.decision === "PAGAR").length,
      frenar: buscadas.filter((f) => f.decision === "FRENAR").length,
      escalar: buscadas.filter((f) => f.decision === "ESCALAR").length,
    },
    filas,
  };
}
