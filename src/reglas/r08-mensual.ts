// R8 Límite mensual por beneficiario (§4.3). Si falla, escala.

import { formatearUsd } from "@/dominio/dinero";

import { evaluacion } from "./catalogo";
import { type ContextoRegla, desactivada, FUERA_DE_LISTA, montoUsd, r3Falla, SIN_DATO, textoDesactivada } from "./contexto";
import { periodoDe } from "./libro";
import { porBeneficiario } from "./presupuesto";

/**
 * FALLA (escala) si lo pagado y reservado del beneficiario en el mes calendario más esta factura supera su límite
 * mensual (el propio o el de las reglas).
 */
export function r08Mensual(ctx: ContextoRegla) {
  if (desactivada(ctx, "R8")) return evaluacion("R8", "NO_APLICA", textoDesactivada(ctx));
  if (r3Falla(ctx) || ctx.beneficiario === null) return evaluacion("R8", "NO_APLICA", FUERA_DE_LISTA);
  const usd = montoUsd(ctx);
  if (usd === null) return evaluacion("R8", "NO_APLICA", SIN_DATO);

  const limite = ctx.beneficiario.limite_mensual_usd ?? ctx.reglas.limites.mensual_por_beneficiario_default_usd;
  // El límite es mensual aunque el presupuesto sea quincenal o trimestral.
  const periodo = periodoDe(ctx.ahora, "mensual");
  const acumulado = porBeneficiario(ctx.historial, periodo, "mensual", ctx.beneficiario.nombre, ctx.tasas);
  const total = acumulado + usd;
  const datos = { acumulado_usd: acumulado, monto_usd: usd, total_usd: total, limite_usd: limite, periodo };
  const signo = total > limite ? ">" : "≤";
  const texto = `${formatearUsd(acumulado)} + ${formatearUsd(usd)} = ${formatearUsd(total)} ${signo} ${formatearUsd(limite)} ${ctx.tasas.base}`;
  return evaluacion("R8", total > limite ? "FALLA" : "CUMPLE", texto, datos);
}
