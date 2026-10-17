import type { Reloj } from "@/dominio/reloj";

const DESFASE_BOGOTA_MS = 5 * 60 * 60 * 1000; // UTC-5 todo el año (sin horario de verano)

/** Reloj real en hora de Bogotá, con el formato de los momentos del registro: 2026-10-16T09:24:00-05:00. */
export function relojSistema(): Reloj {
  return {
    ahora: () => new Date(Date.now() - DESFASE_BOGOTA_MS).toISOString().slice(0, 19) + "-05:00",
  };
}
