// Dinero en centavos enteros, conversión con tasas fijas del periodo y formato es-CO (§6).
// Misma aritmética que scripts/dataset/dinero.py: tests/dominio/dinero.test.ts verifica
// contra el historial generado que ambos lenguajes dan los mismos USD y la misma tasa.

import Decimal from "decimal.js";

import type { Dinero, Moneda, Reglas, TablaTasas } from "./tipos";

/** Copia aislada: no depende de la configuración global de decimal.js. */
const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

/** Monedas que se muestran sin decimales. */
const SIN_DECIMALES: ReadonlySet<Moneda> = new Set(["COP", "CLP"]);

/** "1240.00" → 124000 · "8400000" → 840000000. Redondeo half-up al centavo. */
export function aCentavos(unidades: Decimal.Value): number {
  return new Dec(unidades).times(100).toDecimalPlaces(0, Dec.ROUND_HALF_UP).toNumber();
}

/** Moneda de los límites de unas reglas (#86). Sin `moneda` (versiones anteriores, dataset): USD. */
export const monedaBase = (r: { moneda?: Moneda }): Moneda => r.moneda ?? "USD";

/** Tasa del periodo (1 {base} = X). Error claro si el periodo no tiene esa moneda. */
export function tasaDe(moneda: Moneda, tabla: TablaTasas): Decimal {
  if (moneda === tabla.base) return new Dec(1);
  const tasa = tabla.tasas[moneda];
  if (tasa === undefined) throw new Error(`sin tasa para ${moneda} en el periodo ${tabla.periodo}`);
  return new Dec(tasa);
}

/** Convierte a centavos de la moneda base de la tabla (#86): `round_half_up(monto / tasa)`. */
export function aBase(d: Dinero, tabla: TablaTasas): { base_centavos: number; tasa_usada: string | null } {
  if (d.moneda === tabla.base) return { base_centavos: d.centavos, tasa_usada: null };
  const base = new Dec(d.centavos).div(tasaDe(d.moneda, tabla)).toDecimalPlaces(0, Dec.ROUND_HALF_UP);
  return { base_centavos: base.toNumber(), tasa_usada: formatearTasa(d.moneda, tabla) };
}

/** Igual que `aBase`; el nombre se conserva porque los campos `*_usd` siguen llamándose así (están en la moneda base). */
export function aUsd(d: Dinero, tabla: TablaTasas): { usd_centavos: number; tasa_usada: string | null } {
  const { base_centavos, tasa_usada } = aBase(d, tabla);
  return { usd_centavos: base_centavos, tasa_usada };
}

/**
 * Cambio de moneda base (#86): centavos × tasa (1 vieja = X nueva), redondeado a unidades enteras (half-up), para que
 * los límites queden legibles ("COP 9.548.329" y no "9.548.329,37").
 */
export function convertirLimite(centavos: number, tasa: string): number {
  return new Dec(centavos).times(tasa).div(100).toDecimalPlaces(0, Dec.ROUND_HALF_UP).times(100).toNumber();
}

/** Las reglas con límites, presupuesto y doble firma pasados a `nueva` (1 moneda de las reglas = `tasa` de `nueva`). */
export function convertirReglas(reglas: Reglas, nueva: Moneda, tasa: string): Reglas {
  const c = (centavos: number) => convertirLimite(centavos, tasa);
  const l = reglas.limites;
  return {
    ...reglas,
    moneda: nueva,
    limites: { ...l, pago_automatico_usd: c(l.pago_automatico_usd), maximo_absoluto_usd: c(l.maximo_absoluto_usd), mensual_por_beneficiario_default_usd: c(l.mensual_por_beneficiario_default_usd) },
    presupuesto: { ...reglas.presupuesto, monto_usd: c(reglas.presupuesto.monto_usd) },
    aprobacion: { doble_aprobacion_desde_usd: c(reglas.aprobacion.doble_aprobacion_desde_usd) },
  };
}

/** "8400000" → "8.400.000" (sin regex: recorre de a tres dígitos desde la derecha). */
function agrupar(entero: string): string {
  const grupos: string[] = [];
  for (let fin = entero.length; fin > 0; fin -= 3) grupos.unshift(entero.slice(Math.max(0, fin - 3), fin));
  return grupos.join(".");
}

/** 744405 → "7.444,05" · decimales=false: 840000000 → "8.400.000" */
export function formatearNumero(centavos: number, decimales = true): string {
  if (!Number.isInteger(centavos) || centavos < 0) throw new RangeError(`centavos inválidos: ${centavos}`);
  const enteros = agrupar(Math.trunc(centavos / 100).toString());
  if (!decimales) {
    // Igual que dinero.py: una moneda sin decimales con centavos es un error de datos, no se redondea en silencio.
    if (centavos % 100 !== 0) throw new RangeError(`monto con centavos en moneda sin decimales: ${centavos}`);
    return enteros;
  }
  return `${enteros},${(centavos % 100).toString().padStart(2, "0")}`;
}

/**
 * Número para mostrar que nunca lanza: negativo con "-", centavos no enteros redondeados, NaN/Infinity → "—".
 * Lo usan los formatos de pantalla y de texto: una factura con datos raros (COP con centavos, monto negativo) nunca
 * puede tumbar una pantalla. `formatearNumero` sigue estricto para quien quiera validar.
 */
function mostrarNumero(centavos: number, sinDecimales: boolean): string {
  if (!Number.isFinite(centavos)) return "—";
  const entero = Math.round(centavos);
  const abs = Math.abs(entero);
  return `${entero < 0 ? "-" : ""}${formatearNumero(abs, !sinDecimales || abs % 100 !== 0)}`;
}

/**
 * "USD 7.444,05" · "COP 8.400.000" · "MXN 38.000,00". COP/CLP sin decimales salvo que el monto los traiga: una factura
 * real puede cobrar "COP 316.577,96" y la pantalla tiene que mostrarla tal cual. Nunca lanza.
 */
export function formatear(d: Dinero): string {
  return `${d.moneda} ${mostrarNumero(d.centavos, SIN_DECIMALES.has(d.moneda))}`;
}

/** Monto en la moneda base con su código, también negativo: "USD 7.444,05" · "COP -1.250.000,50" (#86). Nunca lanza. */
export function formatearBase(centavos: number, moneda: Moneda): string {
  return `${moneda} ${mostrarNumero(centavos, SIN_DECIMALES.has(moneda))}`;
}

/** Monto sin código de moneda: "8.400.000" (COP) · "1.240,00" (USD) · "316.577,96" (COP con centavos). Nunca lanza. */
export function formatearMonto(d: Dinero): string {
  return mostrarNumero(d.centavos, SIN_DECIMALES.has(d.moneda));
}

/** Formato de la UI interna para montos en la moneda base, sin código: "7.444,05". Nunca lanza. */
export function formatearUsd(centavos: number): string {
  return mostrarNumero(centavos, false);
}

/** "MXN 18,50" · "COP 4.200,00" · null si es la moneda base (formato de EntradaRegistro.tasa_usada). */
export function formatearTasa(moneda: Moneda, tabla: TablaTasas): string | null {
  if (moneda === tabla.base) return null;
  const tasa = tasaDe(moneda, tabla);
  // Menor que 1 (base COP, factura en USD: 1 COP = 0,000314 USD): 4 cifras significativas, no "0,00" (#86).
  const texto = tasa.lessThan(1) ? tasa.toSignificantDigits(4, Dec.ROUND_HALF_UP).toFixed() : tasa.toFixed(2, Dec.ROUND_HALF_UP);
  const [entero = "0", dec = "00"] = texto.split(".");
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
  let signo = "";
  if (!v.isZero()) signo = v.isPositive() ? "+" : "-";
  return `${signo}${v.abs().toFixed(decimales).replace(".", ",")}%`;
}
