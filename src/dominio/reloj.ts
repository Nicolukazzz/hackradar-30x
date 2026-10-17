// Reloj inyectado (§3): el dominio y las reglas nunca leen la hora del sistema.
// La implementación real vive en src/lib/reloj-sistema.ts (fuera del dominio).

export type Reloj = { ahora(): string };

const ISO_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** Reloj detenido en `iso` (tests y escenarios: `ahora` de escenario.json). */
export function relojFijo(iso: string): Reloj {
  if (!ISO_CON_ZONA.test(iso)) throw new Error(`momento inválido (se espera ISO con zona): ${iso}`);
  return { ahora: () => iso };
}
