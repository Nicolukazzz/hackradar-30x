// Dinero en centavos enteros, conversión con tasas fijas del periodo y formato es-CO (§6).
// Misma aritmética que scripts/dataset/dinero.py: tests/dominio/dinero.test.ts verifica
// contra el historial generado que ambos lenguajes dan los mismos USD y la misma tasa.

import Decimal from "decimal.js";

import type { Dinero, Moneda, TablaTasas } from "./tipos";

/** Copia aislada: no depende de la configuración global de decimal.js. */
const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

/** Monedas que se muestran sin decimales. */
const SIN_DECIMALES: ReadonlySet<Moneda> = new Set(["COP", "CLP"]);

/** "1240.00" → 124000 · "8400000" → 840000000. Redondeo half-up al centavo. */
export function aCentavos(unidades: Decimal.Value): number {
  return new Dec(unidades).times(100).toDecimalPlaces(0, Dec.ROUND_HALF_UP).toNumber();
}

/** Tasa del periodo (1 USD = X). Error claro si el periodo no tiene esa moneda. */
export function tasaDe(moneda: Moneda, tabla: TablaTasas): Decimal {
  if (moneda === "USD") return new Dec(1);
  const tasa = tabla.tasas[moneda];
  if (tasa === undefined) throw new Error(`sin tasa para ${moneda} en el periodo ${tabla.periodo}`);
  return new Dec(tasa);
}

/** Convierte a centavos de USD con la tasa fija del periodo. */
export function aUsd(d: Dinero, tabla: TablaTasas): { usd_centavos: number; tasa_usada: string | null } {
  if (d.moneda === "USD") return { usd_centavos: d.centavos, tasa_usada: null };
  const usd = new Dec(d.centavos).div(tasaDe(d.moneda, tabla)).toDecimalPlaces(0, Dec.ROUND_HALF_UP);
  return { usd_centavos: usd.toNumber(), tasa_usada: formatearTasa(d.moneda, tabla) };
}

function agrupar(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 744405 → "7.444,05" · decimales=false: 840000000 → "8.400.000" */
export function formatearNumero(centavos: number, decimales = true): string {
  if (!Number.isInteger(centavos) || centavos < 0) throw new RangeError(`centavos inválidos: ${centavos}`);
  const enteros = agrupar(Math.trunc(centavos / 100).toString());
  if (!decimales) return enteros;
  return `${enteros},${(centavos % 100).toString().padStart(2, "0")}`;
}

/** "USD 7.444,05" · "COP 8.400.000" · "MXN 38.000,00" */
export function formatear(d: Dinero): string {
  return `${d.moneda} ${formatearNumero(d.centavos, !SIN_DECIMALES.has(d.moneda))}`;
}

/** Formato de la UI interna para montos en USD: "7.444,05" */
export function formatearUsd(centavos: number): string {
  return formatearNumero(centavos);
}

/** "MXN 18,50" · "COP 4.200,00" · null si es USD (formato de EntradaRegistro.tasa_usada). */
export function formatearTasa(moneda: Moneda, tabla: TablaTasas): string | null {
  if (moneda === "USD") return null;
  const [entero = "0", dec = "00"] = tasaDe(moneda, tabla).toFixed(2, Dec.ROUND_HALF_UP).split(".");
  return `${moneda} ${agrupar(entero)},${dec}`;
}

/** Diferencia porcentual de `actual` contra `acordado`: 2600 vs 1800 → 44,44… */
export function diferenciaPct(actual: number, acordado: number): Decimal {
  if (acordado === 0) throw new RangeError("no se puede comparar contra un monto acordado de 0");
  return new Dec(actual).minus(acordado).div(acordado).times(100);
}

/** 44.444 → "+44,4%" · -3.2 → "-3,2%" · 0 → "0,0%" */
export function porcentaje(valor: Decimal.Value, decimales = 1): string {
  const v = new Dec(valor).toDecimalPlaces(decimales, Dec.ROUND_HALF_UP);
  const signo = v.isPositive() && !v.isZero() ? "+" : v.isNegative() && !v.isZero() ? "-" : "";
  return `${signo}${v.abs().toFixed(decimales).replace(".", ",")}%`;
}
