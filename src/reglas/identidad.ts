// Quién cobra (#108): cómo se encuentra al proveedor de la factura en la lista, según el modo que eligió la empresa.
// nombre: nombre normalizado · nit: identificación fiscal · nombre_y_nit: los dos, del mismo proveedor.
// Si falta el dato que el modo exige o no es confiable, no se adivina: R3 queda INDETERMINADO y la factura escala.

import { normalizarIdentificacion, normalizarNombre } from "@/dominio/normalizar";
import type { Beneficiario, Extraccion, ModoIdentidad, Reglas } from "@/dominio/tipos";

/** Por qué se encontró (o no) al proveedor. R3 lo convierte en CUMPLE, FALLA o INDETERMINADO. */
export type MotivoIdentidad =
  /** encontrado según el modo */
  | "ok"
  /** no hay proveedor con ese nombre / NIT */
  | "no_esta"
  /** el modo pide NIT y la factura no lo trae (o no es legible) */
  | "sin_nit_factura"
  /** nombre_y_nit: el proveedor del nombre no tiene NIT registrado */
  | "sin_nit_registrado"
  /** nombre_y_nit: el NIT de la factura no es el registrado para ese nombre */
  | "nit_distinto";

/** Resultado de buscar a quien cobra en la lista permitida. */
export type Identidad = {
  modo: ModoIdentidad;
  motivo: MotivoIdentidad;
  /** solo si motivo = "ok" */
  beneficiario: Beneficiario | null;
  /** el proveedor que coincide por nombre aunque falle el NIT (para el texto de R3) */
  candidato: Beneficiario | null;
  /** NIT leído (si es confiable) */
  nit: string | null;
};

/** Modo de identidad de las reglas. Ausente = por nombre, como el dataset. */
export const modoIdentidad = (r: Pick<Reglas, "identidad">): ModoIdentidad => r.identidad?.modo ?? "nombre";

/**
 * Busca al proveedor de la factura según `modo`. El NIT solo cuenta si su confianza alcanza `confianzaMinima`; ante
 * un dato faltante o dudoso devuelve el motivo y nunca adivina.
 */
export function identificar(ext: Extraccion, beneficiarios: readonly Beneficiario[], modo: ModoIdentidad, confianzaMinima: number): Identidad {
  const nombre = ext.beneficiario_nombre.valor ? normalizarNombre(ext.beneficiario_nombre.valor) : "";
  const porNombre = nombre ? (beneficiarios.find((b) => normalizarNombre(b.nombre) === nombre) ?? null) : null;
  const campoNit = ext.identificacion_fiscal;
  const nit = campoNit?.valor && campoNit.confianza >= confianzaMinima ? campoNit.valor : null;
  const base = { modo, candidato: porNombre, nit };

  if (modo === "nombre") return { ...base, motivo: porNombre ? "ok" : "no_esta", beneficiario: porNombre };

  if (modo === "nit") {
    if (!nit) return { ...base, motivo: "sin_nit_factura", beneficiario: null };
    const clave = normalizarIdentificacion(nit);
    const porNit = beneficiarios.find((b) => b.identificacion_fiscal && normalizarIdentificacion(b.identificacion_fiscal) === clave) ?? null;
    return { ...base, motivo: porNit ? "ok" : "no_esta", beneficiario: porNit, candidato: porNit ?? porNombre };
  }

  // nombre_y_nit
  if (!porNombre) return { ...base, motivo: "no_esta", beneficiario: null };
  if (!porNombre.identificacion_fiscal) return { ...base, motivo: "sin_nit_registrado", beneficiario: null };
  if (!nit) return { ...base, motivo: "sin_nit_factura", beneficiario: null };
  const igual = normalizarIdentificacion(nit) === normalizarIdentificacion(porNombre.identificacion_fiscal);
  return { ...base, motivo: igual ? "ok" : "nit_distinto", beneficiario: igual ? porNombre : null };
}
