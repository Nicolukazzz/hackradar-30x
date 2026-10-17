// Heurística automática de explicabilidad (especificación §14). No juzga si la explicación es
// correcta (eso lo mide la decisión), solo si una persona la entiende sin abrir el código.

import { normalizarTexto } from "@/dominio/normalizar";
import type { DecisionAgente, IdRegla } from "@/dominio/tipos";
import { CATALOGO } from "@/reglas/catalogo";

export const LARGO_MAXIMO = 280;

/**
 * Cómo nombran las plantillas de §7 cada regla. Basta una: la explicación no repite el nombre
 * del catálogo ("Beneficiario en la lista permitida") sino su efecto ("no está en la lista…").
 */
const MENCIONES: Record<IdRegla, string[]> = {
  R1: ["no esta seguro de lo que leyo", "confirmar los datos"],
  R2: ["no se paga dos veces", "cobro repetido", "se paga una sola vez"],
  R3: ["lista de beneficiarios permitidos"],
  R4: ["no es la registrada"],
  R5: ["acordo", "lo acordado"],
  R6: ["maximo absoluto"],
  R7: ["presupuesto disponible"],
  R8: ["sobre su limite"],
  R9: ["limite de pago automatico"],
  R10: ["instrucciones para el agente"],
  R11: ["no esta vinculado"],
};

/** Reglas cuya comparación es numérica: la explicación debe traer al menos una cifra. */
const NUMERICAS: ReadonlySet<IdRegla> = new Set(["R5", "R6", "R7", "R8", "R9"]);

/** Palabras de programador, objetos sin formatear y un id de regla suelto ("R9:" sin texto detrás). */
const JERGA = /\b(null|undefined|NaN|true|false)\b|\[object|\bR\d+:(?=\s*(?:$|[.,;]))/;

function menciona(texto: string, id: IdRegla): boolean {
  if (new RegExp(`\\b${id}\\b`).test(texto)) return true;
  const t = normalizarTexto(texto);
  return [CATALOGO[id].nombre, ...MENCIONES[id]].some((m) => t.includes(normalizarTexto(m)));
}

export function problemasExplicacion(x: { decision: DecisionAgente; reglas: readonly IdRegla[]; explicacion: string }): string[] {
  const { decision, reglas, explicacion } = x;
  const problemas: string[] = [];
  if (explicacion.trim() === "") return ["explicación vacía"];

  const faltan = reglas.filter((id) => !menciona(explicacion, id));
  if (faltan.length > 0) problemas.push(`no menciona ${faltan.join(", ")}`);
  if (decision === "PAGAR" && !normalizarTexto(explicacion).includes("limite automatico")) {
    problemas.push("no dice que está bajo el límite automático");
  }

  const numerica = decision === "PAGAR" || reglas.some((id) => NUMERICAS.has(id));
  if (numerica && !/\d/.test(explicacion)) problemas.push("sin cifras en una comparación numérica");

  const jerga = JERGA.exec(explicacion);
  if (jerga) problemas.push(`jerga interna «${jerga[0]}»`);
  if (explicacion.length > LARGO_MAXIMO) problemas.push(`${explicacion.length} caracteres (máximo ${LARGO_MAXIMO})`);
  return problemas;
}
