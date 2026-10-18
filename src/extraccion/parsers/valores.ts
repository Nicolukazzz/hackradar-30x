// Lectura de valores sueltos sin IA: montos (es-CO, en-US, pt-BR) y fechas (dd/mm/aaaa, "Oct 8, 2026", ISO).

import { aCentavos } from "@/dominio/dinero";
import { MONEDAS, type Dinero, type Moneda } from "@/dominio/tipos";

const CODIGOS = [...MONEDAS].sort((a, b) => b.length - a.length).join("|");

/**
 * Código de moneda + número. Fuente de los patrones de monto en las etiquetas.
 * "USD 1,240.00" · "COP 8.400.000" · "BRL 22.000,00" · "MXN 38,000.00"
 */
export const PATRON_MONTO = `\\b(${CODIGOS})\\s*\\$?\\s*(\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)(?![\\d.,]*\\d)`;

/**
 * "1,240.00" → "1240.00" · "8.400.000" → "8400000" · "2.980,00" → "2980.00".
 * Si termina en separador + 1 o 2 dígitos, ese separador es el decimal; los demás agrupan miles.
 */
export function numeroADecimal(texto: string): string | null {
  const limpio = texto.trim();
  if (!/^\d[\d.,]*$/.test(limpio)) return null;
  const decimal = /[.,](\d{1,2})$/.exec(limpio);
  const entero = (decimal ? limpio.slice(0, decimal.index) : limpio).replace(/[.,]/g, "");
  if (!/^\d+$/.test(entero)) return null;
  return decimal ? `${entero}.${decimal[1]}` : entero;
}

/** true si el código está entre las monedas soportadas. */
export function esMoneda(texto: string): texto is Moneda {
  return (MONEDAS as readonly string[]).includes(texto);
}

/** ("USD", "1,240.00") → { centavos: 124000, moneda: "USD" }. null si no es un monto válido y positivo. */
export function aDinero(moneda: string, numero: string): Dinero | null {
  const m = moneda.toUpperCase();
  const dec = numeroADecimal(numero);
  if (!esMoneda(m) || dec === null) return null;
  const centavos = aCentavos(dec);
  return Number.isSafeInteger(centavos) && centavos > 0 ? { centavos, moneda: m } : null;
}

/** Primer monto con código de moneda dentro de un texto. */
export function buscarMonto(texto: string): Dinero | null {
  const m = new RegExp(PATRON_MONTO, "i").exec(texto);
  return m?.[1] && m[2] ? aDinero(m[1], m[2]) : null;
}

const MESES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  ene: 1, abr: 4, ago: 8, dic: 12, fev: 2, mai: 5, set: 9, out: 10, dez: 12,
};

/** Fecha en cualquiera de los formatos del dataset. Fuente de los patrones de fecha en las etiquetas. */
export const PATRON_FECHA = String.raw`(\d{1,2}/\d{1,2}/\d{4}|\d{4}-\d{2}-\d{2}|[A-Za-z]{3}\.?\s+\d{1,2},\s*\d{4})`;

function iso(anio: number, mes: number, dia: number): string | null {
  // Valida contra el calendario real (sin leer el reloj: se construye desde los números).
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${anio.toString().padStart(4, "0")}-${mes.toString().padStart(2, "0")}-${dia.toString().padStart(2, "0")}`;
}

/** "08/10/2026" → "2026-10-08" (día primero: es/pt) · "Oct 8, 2026" → "2026-10-08" · ISO tal cual. */
export function parsearFecha(texto: string): string | null {
  const t = texto.trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return iso(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^([A-Za-z]{3})\.?\s+(\d{1,2}),\s*(\d{4})$/.exec(t);
  const mes = m?.[1] ? MESES[m[1].toLowerCase()] : undefined;
  if (m && mes) return iso(Number(m[3]), mes, Number(m[2]));
  return null;
}
