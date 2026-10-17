// R3 Beneficiario en la lista permitida (§4.3). Si falla, escala.

import { evaluacion } from "./catalogo";
import type { ContextoRegla } from "./contexto";

export function r03Beneficiario(ctx: ContextoRegla) {
  const { beneficiario, ext, total_permitidos } = ctx;
  const nombre = ext.beneficiario_nombre.valor ?? "El beneficiario (ilegible)";
  if (beneficiario === null) {
    return evaluacion("R3", "FALLA", `${nombre} no está entre los ${total_permitidos} permitidos`, { beneficiario: ext.beneficiario_nombre.valor });
  }
  if (beneficiario.estado !== "activo") {
    return evaluacion("R3", "FALLA", `${beneficiario.nombre} está inactivo en la lista`, { beneficiario_id: beneficiario.id });
  }
  return evaluacion("R3", "CUMPLE", `${beneficiario.nombre} está entre los ${total_permitidos} permitidos`, { beneficiario_id: beneficiario.id });
}
