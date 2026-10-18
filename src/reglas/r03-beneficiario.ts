// R3 Beneficiario en la lista permitida (§4.3). Si falla, escala. #108: según el modo de identidad de la empresa
// (nombre, NIT o los dos). Si falta el dato que el modo exige, INDETERMINADO: nunca se adivina quién cobra.

import { evaluacion } from "./catalogo";
import type { ContextoRegla } from "./contexto";

export function r03Beneficiario(ctx: ContextoRegla) {
  const { beneficiario, ext, total_permitidos, identidad } = ctx;
  const nombre = ext.beneficiario_nombre.valor ?? "El beneficiario (ilegible)";
  const datos = { beneficiario: ext.beneficiario_nombre.valor, modo: identidad?.modo ?? "nombre", motivo: identidad?.motivo ?? null, nit: identidad?.nit ?? null };
  const candidato = identidad?.candidato?.nombre ?? nombre;

  switch (identidad?.motivo) {
    case "sin_nit_factura":
      return evaluacion("R3", "INDETERMINADO", "la factura no trae una identificación fiscal legible y la empresa reconoce a quien cobra por NIT", datos);
    case "sin_nit_registrado":
      return evaluacion("R3", "INDETERMINADO", `${candidato} no tiene identificación fiscal registrada y la empresa reconoce a quien cobra por nombre y NIT`, datos);
    case "nit_distinto":
      return evaluacion("R3", "FALLA", `NIT ${identidad.nit} ≠ ${identidad.candidato?.identificacion_fiscal} registrado para ${candidato}`, {
        ...datos,
        nit_registrado: identidad.candidato?.identificacion_fiscal ?? null,
      });
  }
  if (beneficiario === null) {
    const quien = identidad?.modo === "nit" ? `NIT ${identidad.nit}` : nombre;
    return evaluacion("R3", "FALLA", `${quien} no está entre los ${total_permitidos} permitidos`, datos);
  }
  if (beneficiario.estado !== "activo") {
    return evaluacion("R3", "FALLA", `${beneficiario.nombre} está inactivo en la lista`, { ...datos, beneficiario_id: beneficiario.id });
  }
  const como = identidad && identidad.modo !== "nombre" ? ` (NIT ${identidad.nit})` : "";
  return evaluacion("R3", "CUMPLE", `${beneficiario.nombre}${como} está entre los ${total_permitidos} permitidos`, { ...datos, beneficiario_id: beneficiario.id });
}
