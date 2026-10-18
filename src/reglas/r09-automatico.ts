// R9 Bajo el límite de pago automático (§4.3). Si falla, escala.

import { formatearUsd } from "@/dominio/dinero";

import { evaluacion } from "./catalogo";
import { type ContextoRegla, montoUsd, SIN_DATO } from "./contexto";

/** FALLA (escala) si el monto supera el límite de pago automático: sobre ese monto siempre decide una persona. */
export function r09Automatico(ctx: ContextoRegla) {
  const usd = montoUsd(ctx);
  if (usd === null) return evaluacion("R9", "NO_APLICA", SIN_DATO);
  const limite = ctx.reglas.limites.pago_automatico_usd;
  const datos = { monto_usd: usd, limite_usd: limite };
  if (usd > limite) return evaluacion("R9", "FALLA", `${formatearUsd(usd)} > ${formatearUsd(limite)} ${ctx.tasas.base}`, datos);
  return evaluacion("R9", "CUMPLE", `${formatearUsd(usd)} ≤ ${formatearUsd(limite)} ${ctx.tasas.base}`, datos);
}
