// R6 Bajo el máximo absoluto por pago (§4.3). Si falla, frena.

import { formatearUsd } from "@/dominio/dinero";

import { evaluacion } from "./catalogo";
import { type ContextoRegla, montoUsd, SIN_DATO } from "./contexto";

/** FALLA (frena) si el monto en la moneda base supera el máximo absoluto por pago. */
export function r06Maximo(ctx: ContextoRegla) {
  const usd = montoUsd(ctx);
  if (usd === null) return evaluacion("R6", "NO_APLICA", SIN_DATO);
  const max = ctx.reglas.limites.maximo_absoluto_usd;
  const datos = { monto_usd: usd, maximo_usd: max };
  if (usd > max) return evaluacion("R6", "FALLA", `${formatearUsd(usd)} > ${formatearUsd(max)} ${ctx.tasas.base}`, datos);
  return evaluacion("R6", "CUMPLE", `${formatearUsd(usd)} ≤ ${formatearUsd(max)} ${ctx.tasas.base}`, datos);
}
