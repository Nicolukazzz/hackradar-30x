// R7 Presupuesto disponible del periodo (§4.3, §6). Si falla, frena.

import { formatearUsd } from "@/dominio/dinero";

import { evaluacion } from "./catalogo";
import { type ContextoRegla, montoUsd, SIN_DATO } from "./contexto";

/**
 * FALLA (frena) si el monto supera lo disponible del periodo al momento de evaluar: el presupuesto ya descuenta lo
 * pagado en el lote y lo reservado por escalados.
 */
export function r07Presupuesto(ctx: ContextoRegla) {
  const usd = montoUsd(ctx);
  if (usd === null) return evaluacion("R7", "NO_APLICA", SIN_DATO);
  const p = ctx.presupuesto;
  const datos = { monto_usd: usd, disponible_usd: p.disponible, periodo: p.periodo, reservado_usd: p.reservado };
  const signo = usd > p.disponible ? ">" : "≤";
  const texto = `${formatearUsd(usd)} ${signo} ${p.disponible < 0 ? "-" : ""}${formatearUsd(Math.abs(p.disponible))} ${ctx.tasas.base} disponibles al evaluar`;
  return evaluacion("R7", usd > p.disponible ? "FALLA" : "CUMPLE", texto, datos);
}
