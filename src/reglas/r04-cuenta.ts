// R4 Cuenta destino es la registrada (§4.3). Si falla, escala.

import { evaluacion } from "./catalogo";
import { afectado, type ContextoRegla, FUERA_DE_LISTA, r3Falla, SIN_DATO } from "./contexto";

export function r04Cuenta(ctx: ContextoRegla) {
  if (r3Falla(ctx) || ctx.beneficiario === null) return evaluacion("R4", "NO_APLICA", FUERA_DE_LISTA);
  const leida = ctx.ext.cuenta_destino_ultimos4.valor;
  if (leida === null || afectado(ctx, "cuenta_destino_ultimos4")) return evaluacion("R4", "NO_APLICA", SIN_DATO);
  const registrada = ctx.beneficiario.cuenta.ultimos4;
  const datos = { cuenta_factura: leida, cuenta_registrada: registrada };
  if (leida !== registrada) return evaluacion("R4", "FALLA", `${leida} ≠ ${registrada}`, datos);
  return evaluacion("R4", "CUMPLE", `${leida} = ${registrada}`, datos);
}
