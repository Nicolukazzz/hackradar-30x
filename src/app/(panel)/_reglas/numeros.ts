// Entrada y salida de números en formato de la UI (es-CO): "3.000,00" ↔ 300000 centavos.

import { formatearUsd } from "@/dominio/dinero";

/**
 * "3.000,00" · "3000" · "3000,5" · "3000.50" → centavos. null si no es un monto válido (vacío, letras, negativo).
 * Con coma, los puntos son de miles. Sin coma, un punto seguido de 1–2 dígitos al final es decimal ("3000.50", "1.5");
 * cualquier otro punto es de miles ("3.000").
 */
export function leerUsd(texto: string): number | null {
  const limpio = texto.trim().replace(/^usd\s*/i, "");
  const t = !limpio.includes(",") && /^\d+\.\d{1,2}$/.test(limpio) ? limpio : limpio.replaceAll(".", "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const centavos = Math.round(Number(t) * 100);
  return Number.isSafeInteger(centavos) ? centavos : null;
}

/** 300000 → "3.000,00" */
export function escribirUsd(centavos: number): string {
  return formatearUsd(centavos);
}

/** "2" · "2,5" → 2.5. null si no es un número ≥ 0. */
export function leerDecimal(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/** 2.5 → "2,5" */
export function escribirDecimal(n: number): string {
  return String(n).replace(".", ",");
}
