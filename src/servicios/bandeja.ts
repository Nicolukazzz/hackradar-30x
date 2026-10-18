// GET /api/bandeja (§12, pantalla §13.1): KPIs, presupuesto del periodo y filas del lote.

import { estadoHumano } from "@/aprobaciones/decidir";
import { normalizarNombre, normalizarTexto } from "@/dominio/normalizar";
import { monedaBase } from "@/dominio/dinero";
import type { Canal, DecisionAgente, Dinero, EntradaRegistro, Formato, IdRegla, Moneda } from "@/dominio/tipos";
import { facturasVigentes, periodoDe, totalEn } from "@/reglas/libro";
import type { Repositorio } from "@/repositorio/repositorio";

import { ahoraHumano, descripcionBeneficiario, enLaBase, entradasDelLote, estadoActual, type EstadoFactura, montoEstimado } from "./comun";

/** Pestaña de la Bandeja. */
export type FiltroDecision = "todas" | "pagar" | "frenar" | "escalar";

/** Una factura en la Bandeja: decisión del agente, estado actual y lo necesario para la vista previa. */
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
  /** #86: moneda de `monto_usd_centavos` (la base con la que se decidió) */
  moneda_base: Moneda;
  /** #129: confianza con la que se leyó el total (monto_usd null = dudoso o sin leer) */
  monto_confianza: number | null;
  /** #141: el total dudoso convertido a la moneda base, solo para mostrarlo (null si es seguro o no hay tasa) */
  monto_estimado: Dinero | null;
  /** lo que decidió el agente */
  decision: DecisionAgente;
  /** lo que ve la persona hoy: la decisión del agente o la resolución humana */
  estado: EstadoFactura;
  explicacion: string;
  reglas_que_fallaron: IdRegla[];
  comparaciones: string[];
  /** #131: fecha de vencimiento de la factura (si se leyó) */
  vence: string | null;
  /** #131: la decisión del agente completa (vista previa de la factura; sin `texto_crudo`, que pesa y no se muestra) */
  entrada: EntradaRegistro;
  /** #131: la decisión humana final, si la hay */
  humana: EntradaRegistro | null;
};

/** #131: indicadores de la Bandeja para el día a día de cuentas por pagar (no pagamos: aprobamos). */
export type ResumenBandeja = {
  /** escaladas que esperan a una persona */
  por_aprobar: ConteoMonto;
  /** de las anteriores, las que vencen en 7 días o menos (y cuántas ya vencen hoy o vencieron) */
  vencen_semana: ConteoMonto & { hoy: number };
  /** aprobadas para pago: por el agente (PAGAR) o por una persona */
  aprobadas: ConteoMonto;
  /** frenadas: esperan que el proveedor corrija */
  frenadas: ConteoMonto;
};

/** Cantidad y suma en centavos de la moneda base (las facturas sin monto confiable cuentan pero no suman). */
export type ConteoMonto = { n: number; usd_centavos: number };

/** Indicadores, presupuesto del periodo, conteos por pestaña y filas filtradas. */
export type RespuestaBandeja = {
  /** id del periodo de presupuesto (periodoDe: "2026-10" · "2026-10-Q2" · "2026-T4") */
  periodo: string;
  /** mes calendario del lote, para mostrar ("2026-10") */
  mes: string;
  /** meses con facturas, el más reciente primero (filtro de periodo de la Bandeja, #119) */
  meses: string[];
  /** mes filtrado ("2026-10") o null = todos */
  mes_filtrado: string | null;
  /** cuándo decidió el agente (null si aún no hay lote) */
  procesado_en: string | null;
  /** documentos del escenario que esperan "Procesar facturas nuevas" */
  por_procesar: number;
  /** #86: moneda de los totales (KPIs, presupuesto): la de las reglas vigentes */
  moneda_base: Moneda;
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
  resumen: ResumenBandeja;
  filas: FilaBandeja[];
};

const FILTRO: Record<Exclude<FiltroDecision, "todas">, DecisionAgente> = { pagar: "PAGAR", frenar: "FRENAR", escalar: "ESCALAR" };

function suma(lote: EntradaRegistro[], d: DecisionAgente, base: Moneda): ConteoMonto {
  const de = lote.filter((e) => e.decision === d);
  return { n: de.length, usd_centavos: de.reduce((s, e) => s + (enLaBase(e, base) ?? 0), 0) };
}

/** Filtros de la Bandeja; todos opcionales. */
export type OpcionesBandeja = { decision?: FiltroDecision; q?: string; /** "AAAA-MM": solo facturas recibidas ese mes */ mes?: string };

/** Arma la Bandeja: indicadores del día a día, presupuesto vigente y filas filtradas por decisión, mes y búsqueda. */
export async function obtenerBandeja(repo: Repositorio, opciones: OpcionesBandeja = {}): Promise<RespuestaBandeja> {
  const [{ registro, lote: todoElLote }, esc, reglas, datos, pendientes] = await Promise.all([
    entradasDelLote(repo),
    repo.escenario(),
    repo.reglasVigentes(),
    repo.datosComunes(),
    repo.pendientes(),
  ]);
  const ahora = esc?.config.ahora ?? todoElLote.at(-1)?.momento ?? "";
  // Filtro de periodo (#119): KPIs y filas del mes elegido; el presupuesto sigue siendo el del periodo vigente.
  const meses = [...new Set(todoElLote.map((e) => e.momento.slice(0, 7)))].sort((a, b) => b.localeCompare(a));
  const mes_filtrado = opciones.mes && meses.includes(opciones.mes) ? opciones.mes : null;
  const lote = mes_filtrado ? todoElLote.filter((e) => e.momento.startsWith(mes_filtrado)) : todoElLote;
  const tipo = reglas.presupuesto.periodo;
  // El periodo de presupuesto sale del tipo de las reglas vigentes (mensual, quincenal o trimestral), no del escenario.
  const periodo = periodoDe(ahora, tipo);

  // Presupuesto (§6): lo pagado antes del lote sale del historial importado; el resto, del lote y sus resoluciones.
  const importadas = new Set(registro.slice(0, esc?.entradas_importadas ?? 0).map((e) => e.id));
  // #86: montos de decisiones tomadas con otra moneda base, convertidos a la de hoy (si no hay tasa, sin convertir).
  const tasas = datos.tasas[ahora.slice(0, 7)];
  let vigentes;
  try {
    vigentes = facturasVigentes(registro, tasas);
  } catch {
    vigentes = facturasVigentes(registro);
  }
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
    const humana = estadoHumano(registro, e).final;
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
      monto_confianza: e.extraccion?.monto_total.confianza ?? null,
      monto_estimado: montoEstimado(e, datos, reglas),
      moneda_base: e.moneda_base ?? "USD",
      decision: e.decision as DecisionAgente,
      estado: estadoActual(registro, e).estado,
      explicacion: e.explicacion,
      reglas_que_fallaron: e.reglas_que_fallaron,
      comparaciones: e.comparaciones,
      vence: e.extraccion?.fecha_vencimiento.valor ?? null,
      entrada: sinTexto(e),
      humana: humana ? sinTexto(humana) : null,
    };
  });
  const resumen = resumir(todas, (await ahoraHumano(repo)).slice(0, 10), monedaBase(reglas));

  const q = normalizarTexto(opciones.q ?? "").trim();
  const filtro = opciones.decision && opciones.decision !== "todas" ? FILTRO[opciones.decision] : null;
  // La búsqueda filtra primero; los conteos de las pestañas siguen a la búsqueda.
  const buscadas = todas.filter((f) => !q || normalizarTexto(`${f.factura_numero ?? ""} ${f.beneficiario ?? ""} ${f.ref_interna}`).includes(q));
  const filas = buscadas.filter((f) => !filtro || f.decision === filtro);

  return {
    periodo,
    mes: (esc?.config.ahora ?? ahora).slice(0, 7),
    meses,
    mes_filtrado,
    procesado_en: lote.length > 0 ? ahora : null,
    por_procesar: pendientes.length,
    moneda_base: monedaBase(reglas),
    kpis: {
      total: lote.length,
      con_esperado: conEsperado.length,
      coinciden,
      pagos_fuera_de_reglas,
      autonomas,
      autonomia: lote.length === 0 ? 0 : autonomas / lote.length,
      pagadas: suma(lote, "PAGAR", monedaBase(reglas)),
      frenadas: suma(lote, "FRENAR", monedaBase(reglas)),
      escaladas: suma(lote, "ESCALAR", monedaBase(reglas)),
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
    resumen,
    filas,
  };
}

/** La entrada sin el texto completo del documento: la vista previa no lo usa y puede pesar varios KB. */
function sinTexto(e: EntradaRegistro): EntradaRegistro {
  return e.extraccion ? { ...e, extraccion: { ...e.extraccion, texto_crudo: "" } } : e;
}

const sumaDe = (filas: readonly FilaBandeja[], monto: (f: FilaBandeja) => number | null): ConteoMonto => ({
  n: filas.length,
  usd_centavos: filas.reduce((s, f) => s + (monto(f) ?? 0), 0),
});

/** Monto de la fila en la base de hoy; la que quedó en otra moneda (sin tasa) no se suma. */
const deFila = (f: FilaBandeja, base: Moneda) => enLaBase(f, base);

/** `hoy` AAAA-MM-DD en hora de la empresa. */
function resumir(filas: readonly FilaBandeja[], hoy: string, base: Moneda): ResumenBandeja {
  const enSieteDias = new Date(Date.parse(`${hoy}T12:00:00Z`) + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const pendientes = filas.filter((f) => f.estado === "ESCALAR");
  const pronto = pendientes.filter((f) => f.vence !== null && f.vence <= enSieteDias);
  return {
    por_aprobar: sumaDe(pendientes, (f) => deFila(f, base)),
    vencen_semana: { ...sumaDe(pronto, (f) => deFila(f, base)), hoy: pronto.filter((f) => f.vence! <= hoy).length },
    // Lo aprobado por una persona cuenta con el monto que ella confirmó (#129).
    aprobadas: sumaDe(
      filas.filter((f) => f.estado === "PAGAR" || f.estado === "APROBADA_HUMANO"),
      (f) => (f.humana?.monto_usd_centavos != null ? enLaBase(f.humana, base) : deFila(f, base)),
    ),
    frenadas: sumaDe(
      filas.filter((f) => f.estado === "FRENAR"),
      (f) => deFila(f, base),
    ),
  };
}
