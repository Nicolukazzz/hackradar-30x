// Contexto común de las reglas (especificación §4.1) y datos derivados que varias reglas comparten.
// Todo es puro: sin I/O, sin reloj. `ahora` llega como dato.

import { aUsd, formatearNumero } from "@/dominio/dinero";
import type {
  Beneficiario,
  Dinero,
  DocumentoRecibido,
  EntradaRegistro,
  EvaluacionRegla,
  Extraccion,
  IdRegla,
  Moneda,
  Reglas,
  TablaTasas,
} from "@/dominio/tipos";

import { esFechaValida, fechaDe, fechaLegible } from "./fechas";
import type { EstadoPresupuesto } from "./presupuesto";

export type ContextoRegla = {
  doc: DocumentoRecibido;
  ext: Extraccion;
  reglas: Reglas;
  tasas: TablaTasas;
  /** match por nombre normalizado; null = no está en la lista */
  beneficiario: Beneficiario | null;
  /** cuántos beneficiarios activos tiene la lista (para el texto de R3) */
  total_permitidos: number;
  /** registro previo + decisiones anteriores del mismo lote */
  historial: EntradaRegistro[];
  presupuesto: EstadoPresupuesto;
  ahora: string;
};

/** Firma común (§4.1): función pura, sin I/O ni reloj. */
export type Regla = (ctx: ContextoRegla) => EvaluacionRegla;

export const CAMPOS_OBLIGATORIOS = [
  "beneficiario_nombre",
  "numero",
  "monto_total",
  "fecha_emision",
  "fecha_vencimiento",
  "cuenta_destino_ultimos4",
  "concepto",
] as const;
export type CampoObligatorio = (typeof CAMPOS_OBLIGATORIOS)[number];

export const ETIQUETA_CAMPO: Record<CampoObligatorio, string> = {
  beneficiario_nombre: "beneficiario",
  numero: "número de factura",
  monto_total: "monto total",
  fecha_emision: "fecha de emisión",
  fecha_vencimiento: "fecha de vencimiento",
  cuenta_destino_ultimos4: "cuenta destino",
  concepto: "concepto",
};

/** Texto de las reglas que dependen de un campo que R1 marcó. */
export const SIN_DATO = "sin dato confiable (ver R1)";
export const FUERA_DE_LISTA = "beneficiario fuera de la lista (ver R3)";

/** Monedas que se escriben sin decimales (igual que dinero.ts). */
const SIN_DECIMALES: ReadonlySet<Moneda> = new Set(["COP", "CLP"]);

/** Número en la moneda dada, sin código: COP → "5.350.000", USD → "1.250,00". */
export function numeroEn(d: Dinero): string {
  return formatearNumero(Math.abs(d.centavos), !SIN_DECIMALES.has(d.moneda) || d.centavos % 100 !== 0);
}

/** "94%" */
export function pctEntero(confianza: number): string {
  return `${Math.floor(confianza * 100)}%`;
}

export type Afectacion = { campo: CampoObligatorio; motivo: string };

/**
 * R1 (§4.3): campos faltantes, de baja confianza o que participan en una validación fallida.
 * El orden es estable (orden de CAMPOS_OBLIGATORIOS y luego validaciones) para que el texto sea reproducible.
 */
export function afectaciones(ctx: ContextoRegla): Afectacion[] {
  // Varias reglas lo piden para el mismo documento: se calcula una vez por contexto.
  const guardado = cache.get(ctx);
  if (guardado) return guardado;
  const lista = calcularAfectaciones(ctx);
  cache.set(ctx, lista);
  return lista;
}

const cache = new WeakMap<ContextoRegla, Afectacion[]>();

/** NaN también cuenta como baja confianza. */
export function bajaConfianza(confianza: number, minima: number): boolean {
  return Number.isNaN(confianza) || confianza < minima;
}

function motivoCampo(ctx: ContextoRegla, campo: CampoObligatorio): string | null {
  const c = ctx.ext[campo];
  const minima = ctx.reglas.extraccion.confianza_minima;
  if (c.valor === null || (typeof c.valor === "string" && c.valor.trim() === "")) return `falta ${ETIQUETA_CAMPO[campo]}`;
  if (bajaConfianza(c.confianza, minima)) return `confianza de ${ETIQUETA_CAMPO[campo]} ${pctEntero(c.confianza)} < ${pctEntero(minima)}`;
  return null;
}

function motivoMonto(ctx: ContextoRegla): string | null {
  const { ext, tasas } = ctx;
  const total = ext.monto_total.valor;
  if (!total) return null;
  if (!Number.isInteger(total.centavos) || total.centavos <= 0) return "el monto total no es mayor que 0";
  if (total.moneda !== "USD" && tasas.tasas[total.moneda] === undefined) return `no hay tasa para ${total.moneda} en ${tasas.periodo}`;
  // Encontrado por fast-check: COP 1 redondea a USD 0,00 y pasaría todos los límites.
  if (aUsd(total, tasas).usd_centavos <= 0) return `${numeroEn(total)} ${total.moneda} equivale a USD 0,00`;
  const sub = ext.subtotal?.valor;
  const imp = ext.impuestos?.valor;
  if (!sub || !imp) return null;
  const mismaMoneda = sub.moneda === total.moneda && imp.moneda === total.moneda;
  if (mismaMoneda && sub.centavos + imp.centavos === total.centavos) return null;
  return `subtotal ${numeroEn(sub)} + impuestos ${numeroEn(imp)} ≠ total ${numeroEn(total)} ${total.moneda}`;
}

function motivoEmision(ctx: ContextoRegla): string | null {
  const emision = ctx.ext.fecha_emision.valor;
  const hoy = fechaDe(ctx.ahora);
  if (!emision) return null;
  if (!esFechaValida(emision)) return `fecha de emisión inválida (${emision})`;
  if (emision > hoy) return `fecha de emisión ${fechaLegible(emision)} posterior a hoy ${fechaLegible(hoy)}`;
  return null;
}

function motivoVencimiento(ctx: ContextoRegla): string | null {
  const emision = ctx.ext.fecha_emision.valor;
  const vence = ctx.ext.fecha_vencimiento.valor;
  if (!vence) return null;
  if (!esFechaValida(vence)) return `fecha de vencimiento inválida (${vence})`;
  if (emision && esFechaValida(emision) && vence < emision) return `vence ${fechaLegible(vence)} antes de emitirse ${fechaLegible(emision)}`;
  return null;
}

function motivoCuenta(ctx: ContextoRegla): string | null {
  const cuenta = ctx.ext.cuenta_destino_ultimos4.valor;
  return cuenta && !/^\d{4}$/.test(cuenta) ? `cuenta destino ilegible (${cuenta})` : null;
}

/** Validaciones de §4.3 R1 por campo; solo se aplican si el campo no quedó ya marcado por falta o confianza. */
const VALIDACIONES: readonly [CampoObligatorio, (ctx: ContextoRegla) => string | null][] = [
  ["monto_total", motivoMonto],
  ["fecha_emision", motivoEmision],
  ["fecha_vencimiento", motivoVencimiento],
  ["cuenta_destino_ultimos4", motivoCuenta],
];

function calcularAfectaciones(ctx: ContextoRegla): Afectacion[] {
  const lista: Afectacion[] = [];
  for (const campo of CAMPOS_OBLIGATORIOS) {
    const motivo = motivoCampo(ctx, campo);
    if (motivo) lista.push({ campo, motivo });
  }
  for (const [campo, validar] of VALIDACIONES) {
    if (lista.some((a) => a.campo === campo)) continue;
    const motivo = validar(ctx);
    if (motivo) lista.push({ campo, motivo });
  }
  return lista;
}

export function afectado(ctx: ContextoRegla, campo: CampoObligatorio): boolean {
  return afectaciones(ctx).some((a) => a.campo === campo);
}

/** Monto en centavos USD si el monto es confiable; null si R1 lo marcó. */
export function montoUsd(ctx: ContextoRegla): number | null {
  const total = ctx.ext.monto_total.valor;
  if (!total || afectado(ctx, "monto_total")) return null;
  return aUsd(total, ctx.tasas).usd_centavos;
}

/** R3 falla: el beneficiario no está en la lista o está inactivo. */
export function r3Falla(ctx: ContextoRegla): boolean {
  return ctx.beneficiario?.estado !== "activo";
}

/** Solo R5 y R8 se pueden desactivar (§4.2): el resto se evalúa siempre aunque `activas` diga false. */
export function desactivada(ctx: ContextoRegla, id: IdRegla): boolean {
  return (id === "R5" || id === "R8") && ctx.reglas.activas[id] === false;
}

export function textoDesactivada(ctx: ContextoRegla): string {
  return `Regla desactivada en v${ctx.reglas.version}`;
}
