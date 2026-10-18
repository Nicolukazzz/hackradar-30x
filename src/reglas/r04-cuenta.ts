// R4 Cuenta destino es la registrada (§4.3). Si falla, escala.

import { evaluacion } from "./catalogo";
import { afectado, type ContextoRegla, cuentaExigida, FUERA_DE_LISTA, r3Falla, SIN_DATO } from "./contexto";

/**
 * Compara los últimos 4 dígitos de la cuenta de la factura con los registrados. NO_APLICA si R3 falla, si la cuenta
 * no se leyó (R1 ya escala) o si la empresa no exige cuenta y la factura no trae ninguna.
 */
export function r04Cuenta(ctx: ContextoRegla) {
  if (r3Falla(ctx) || ctx.beneficiario === null) return evaluacion("R4", "NO_APLICA", FUERA_DE_LISTA);
  const leida = ctx.ext.cuenta_destino_ultimos4.valor;
  const registrada = ctx.beneficiario.cuenta.ultimos4;
  // #109: la empresa no exige la cuenta y la factura no la trae → se paga a la registrada. Si trae otra, sigue fallando.
  if (leida === null && !cuentaExigida(ctx) && !afectado(ctx, "cuenta_destino_ultimos4")) {
    return evaluacion("R4", "NO_APLICA", `la factura no trae cuenta y la empresa no la exige: se paga a la registrada (•••• ${registrada})`, {
      cuenta_factura: null,
      cuenta_registrada: registrada,
      cuenta_no_exigida: true,
    });
  }
  if (leida === null || afectado(ctx, "cuenta_destino_ultimos4")) return evaluacion("R4", "NO_APLICA", SIN_DATO);
  const datos = { cuenta_factura: leida, cuenta_registrada: registrada };
  if (leida !== registrada) return evaluacion("R4", "FALLA", `${leida} ≠ ${registrada}`, datos);
  return evaluacion("R4", "CUMPLE", `${leida} = ${registrada}`, datos);
}
