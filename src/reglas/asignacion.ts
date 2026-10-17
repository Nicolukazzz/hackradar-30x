// A quién se escala y para cuándo (especificación §10).

import type { Aprobador, EvaluacionRegla } from "@/dominio/tipos";

import { esFechaValida, fechaDe, sumarDias, zonaDe } from "./fechas";

/**
 * Al aprobador principal (CFO) si falló R9 o R10 o el monto supera el límite del otro aprobador;
 * si no, al otro aprobador. Sin otro aprobador, siempre al principal.
 */
export function asignarAprobador(
  evaluaciones: readonly EvaluacionRegla[],
  monto_usd_centavos: number | null,
  aprobadores: readonly Aprobador[],
): string | null {
  const principal = aprobadores.find((a) => a.principal) ?? aprobadores[0];
  const otro = aprobadores.find((a) => a !== principal);
  if (!principal) return null;
  if (!otro) return principal.id;
  const fallo = (id: string) => evaluaciones.some((e) => e.id === id && e.resultado === "FALLA");
  // Sin monto confiable (R1) se asigna como si fuera 0, igual que §10 y esperado.json (RV-1188 → ap).
  const superaOtro = otro.limite_usd !== null && (monto_usd_centavos ?? 0) > otro.limite_usd;
  return fallo("R9") || fallo("R10") || superaOtro ? principal.id : otro.id;
}

/** vencimiento − 3 días a las 12:00; si eso ya pasó o es hoy (o no hay vencimiento confiable) → hoy 18:00. */
export function responderAntesDe(fecha_vencimiento: string | null, ahora: string): string {
  const hoy = fechaDe(ahora);
  const zona = zonaDe(ahora);
  if (fecha_vencimiento && esFechaValida(fecha_vencimiento)) {
    const limite = sumarDias(fecha_vencimiento, -3);
    if (limite > hoy) return `${limite}T12:00:00${zona}`;
  }
  return `${hoy}T18:00:00${zona}`;
}
