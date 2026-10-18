// Reloj inyectado (§3): el dominio y las reglas nunca leen la hora del sistema.
// La implementación real vive en src/lib/reloj-sistema.ts (fuera del dominio).

import { MomentoSchema } from "./esquemas";

/** Fuente de la hora actual (ISO con zona). Se inyecta para que motor, evaluación y tests sean deterministas. */
export type Reloj = { ahora(): string };

/** Reloj detenido en `iso` (tests y escenarios: `ahora` de escenario.json). Misma validación que los datos. */
export function relojFijo(iso: string): Reloj {
  if (!MomentoSchema.safeParse(iso).success) throw new Error(`momento inválido (se espera ISO con zona): ${iso}`);
  return { ahora: () => iso };
}

/** Milisegundos desde época de un momento ISO con zona: para ordenar por instante real, no por texto. */
export function instante(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`momento inválido: ${iso}`);
  return ms;
}
