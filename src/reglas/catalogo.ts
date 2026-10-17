// Tabla de reglas (especificación §4.2): nombre visible y qué pasa si falla.

import type { EvaluacionRegla, IdRegla, ResultadoRegla } from "@/dominio/tipos";

export type SiFalla = EvaluacionRegla["si_falla"];

export const CATALOGO: Record<IdRegla, { nombre: string; si_falla: SiFalla }> = {
  R1: { nombre: "Extracción completa y confiable", si_falla: "ESCALAR" },
  R2: { nombre: "No es duplicada", si_falla: "FRENAR" },
  R3: { nombre: "Beneficiario en la lista permitida", si_falla: "ESCALAR" },
  R4: { nombre: "Cuenta destino es la registrada", si_falla: "ESCALAR" },
  R5: { nombre: "Cuadra con lo acordado", si_falla: "FRENAR" },
  R6: { nombre: "Bajo el máximo absoluto por pago", si_falla: "FRENAR" },
  R7: { nombre: "Presupuesto disponible del periodo", si_falla: "FRENAR" },
  R8: { nombre: "Límite mensual por beneficiario", si_falla: "ESCALAR" },
  R9: { nombre: "Bajo el límite de pago automático", si_falla: "ESCALAR" },
  R10: { nombre: "Sin instrucciones dirigidas al agente", si_falla: "ESCALAR" },
  R11: { nombre: "Remitente verificado", si_falla: "ESCALAR" },
};

/** Arma una EvaluacionRegla con el nombre y el efecto del catálogo. */
export function evaluacion(
  id: IdRegla,
  resultado: ResultadoRegla,
  comparacion: string,
  datos: EvaluacionRegla["datos"] = {},
): EvaluacionRegla {
  return { id, ...CATALOGO[id], resultado, comparacion, datos };
}
