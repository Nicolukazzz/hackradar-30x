// Combinación de resultados (especificación §5, pasos 1–3) con guardas de defensa para PAGAR.

import type { DecisionAgente, EvaluacionRegla, IdRegla } from "@/dominio/tipos";

/** Para PAGAR estas reglas deben dar CUMPLE (nunca NO_APLICA): invariantes 1 y 2 de §5. */
const DEBEN_CUMPLIR_PARA_PAGAR: readonly IdRegla[] = ["R1", "R3", "R4", "R6", "R7", "R9", "R11"];

/** Decisión de las reglas de pago y las reglas que fallaron (FALLA o INDETERMINADO), en orden R1→R11. */
export type Combinacion = { decision: Exclude<DecisionAgente, "RECHAZADA_NO_FACTURA">; reglas_que_fallaron: IdRegla[] };

/**
 * 1. Alguna regla de frenar da FALLA → FRENAR.
 * 2. Si no, alguna da FALLA o INDETERMINADO → ESCALAR.
 * 3. Si todas dan CUMPLE o NO_APLICA → PAGAR, salvo que falte una condición mínima de pago (→ ESCALAR).
 */
export function combinar(evaluaciones: readonly EvaluacionRegla[], monto_usd_centavos: number | null): Combinacion {
  const reglas_que_fallaron = evaluaciones.filter((e) => e.resultado === "FALLA" || e.resultado === "INDETERMINADO").map((e) => e.id);
  if (evaluaciones.some((e) => e.si_falla === "FRENAR" && e.resultado === "FALLA")) return { decision: "FRENAR", reglas_que_fallaron };
  if (reglas_que_fallaron.length > 0) return { decision: "ESCALAR", reglas_que_fallaron };

  // #109: R4 puede no aplicar solo si la empresa no exige la cuenta y la factura no trae ninguna (se paga a la registrada).
  const cuentaNoExigida = (e: EvaluacionRegla) => e.id === "R4" && e.resultado === "NO_APLICA" && e.datos.cuenta_no_exigida === true;
  const cumple = (id: IdRegla) => evaluaciones.some((e) => e.id === id && (e.resultado === "CUMPLE" || cuentaNoExigida(e)));
  const completas = evaluaciones.length === 11 && DEBEN_CUMPLIR_PARA_PAGAR.every(cumple);
  if (!completas || monto_usd_centavos === null) return { decision: "ESCALAR", reglas_que_fallaron };
  return { decision: "PAGAR", reglas_que_fallaron };
}
