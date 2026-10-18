// R3 Beneficiario en la lista permitida (§4.3). Si falla, FRENA: solo se paga a proveedores de la lista y con la
// identidad que la empresa exige (#108: nombre, NIT o los dos). Un proveedor nuevo se agrega en Proveedores y la
// factura se reenvía. Excepciones: un proveedor nuevo invitado al portal (#85) escala para que una persona decida su
// primera factura; y si el dato de identidad no se pudo LEER con confianza (foto borrosa, lector caído),
// INDETERMINADO → escala (R1 explica qué no se leyó): no se niega una factura por un error de lectura del agente.

import { esRemitenteInvitacion } from "@/dominio/remitente";
import type { Campo } from "@/dominio/tipos";

import { evaluacion } from "./catalogo";
import type { ContextoRegla } from "./contexto";

const confiable = (c: Campo<unknown> | undefined, minima: number) => !!c && c.valor !== null && c.confianza >= minima;

/** El resto de la factura se leyó bien: si falta el nombre o el NIT, es que la factura no lo trae (no que no se leyó). */
function lecturaConfiable(ctx: ContextoRegla): boolean {
  const { ext } = ctx;
  const minima = ctx.reglas.extraccion.confianza_minima;
  return ext.es_factura.valor === true && confiable(ext.es_factura, minima) && confiable(ext.numero, minima) && confiable(ext.monto_total, minima);
}

/** Qué dato de identidad no se pudo leer con confianza (null si se leyó, o si la factura de verdad no lo trae). */
function datoDudoso(ctx: ContextoRegla): string | null {
  const { ext } = ctx;
  const minima = ctx.reglas.extraccion.confianza_minima;
  const modo = ctx.identidad?.modo ?? "nombre";
  const leidoBien = lecturaConfiable(ctx);
  const dudoso = (c: Campo<unknown> | undefined) => (c?.valor != null && c.confianza < minima) || (c?.valor == null && !leidoBien);
  // Sin nombre no se distingue "no lo trae" de "no se pudo leer" (foto, lector caído): siempre escala, nunca se niega.
  if (modo !== "nit" && (ext.beneficiario_nombre.valor == null || dudoso(ext.beneficiario_nombre))) return "el nombre de quien cobra";
  if (modo !== "nombre" && dudoso(ext.identificacion_fiscal)) return "la identificación fiscal (NIT)";
  return null;
}

/**
 * CUMPLE si quien cobra está activo en la lista, reconocido según el modo de identidad. FALLA (frena) si no está o su
 * NIT no corresponde; escala si llegó por el portal o una invitación; INDETERMINADO si el nombre o NIT no se leyó con
 * confianza.
 */
export function r03Beneficiario(ctx: ContextoRegla) {
  const { beneficiario, ext, total_permitidos, identidad } = ctx;
  const nombre = ext.beneficiario_nombre.valor ?? "El beneficiario (ilegible)";
  const datos = { beneficiario: ext.beneficiario_nombre.valor, modo: identidad?.modo ?? "nombre", motivo: identidad?.motivo ?? null, nit: identidad?.nit ?? null };
  const candidato = identidad?.candidato?.nombre ?? nombre;

  const dudoso = beneficiario?.estado === "activo" && identidad?.motivo !== "sin_nit_factura" ? null : datoDudoso(ctx);
  if (dudoso) return evaluacion("R3", "INDETERMINADO", `no se pudo leer con confianza ${dudoso} (ver R1)`, { ...datos, lectura_dudosa: true });

  switch (identidad?.motivo) {
    case "sin_nit_factura":
      return evaluacion("R3", "FALLA", "la factura no trae la identificación fiscal y la empresa reconoce a quien cobra por NIT", datos);
    case "sin_nit_registrado":
      return evaluacion("R3", "FALLA", `${candidato} no tiene identificación fiscal registrada y la empresa reconoce a quien cobra por nombre y NIT`, datos);
    case "nit_distinto":
      return evaluacion("R3", "FALLA", `NIT ${identidad.nit} ≠ ${identidad.candidato?.identificacion_fiscal} registrado para ${candidato}`, {
        ...datos,
        nit_registrado: identidad.candidato?.identificacion_fiscal ?? null,
      });
  }
  if (beneficiario === null) {
    const quien = identidad?.modo === "nit" ? `NIT ${identidad.nit}` : nombre;
    const fuera = evaluacion("R3", "FALLA", `${quien} no está entre los ${total_permitidos} permitidos`, datos);
    // Proveedor nuevo que la empresa invitó (#28 enlace de invitación, #85 acceso al portal): todo lo que entra por el
    // portal tiene un acceso que creó la empresa, así que su primera factura la decide una persona (escala, no frena).
    if (ctx.doc.canal === "portal" || esRemitenteInvitacion(ctx.doc.remitente.valor)) return { ...fuera, si_falla: "ESCALAR" as const, datos: { ...datos, invitado: true } };
    return fuera;
  }
  if (beneficiario.estado !== "activo") {
    return evaluacion("R3", "FALLA", `${beneficiario.nombre} está inactivo en la lista`, { ...datos, beneficiario_id: beneficiario.id });
  }
  const como = identidad && identidad.modo !== "nombre" ? ` (NIT ${identidad.nit})` : "";
  return evaluacion("R3", "CUMPLE", `${beneficiario.nombre}${como} está entre los ${total_permitidos} permitidos`, { ...datos, beneficiario_id: beneficiario.id });
}
