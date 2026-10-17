// Repositorio fresco del lote demo por test, y helpers para entradas sintéticas.

import type { EntradaRegistro } from "@/dominio/tipos";
import { fijarRepositorio } from "@/repositorio";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import type { Repositorio } from "@/repositorio/repositorio";
import { procesarPendientes } from "@/servicios/lote";

/**
 * Cookie "actuar_como" simulada para las rutas (next/headers no existe fuera de una petición).
 * Cada archivo de test que llama rutas declara:
 *   vi.mock("next/headers", () => ({ cookies: async () => cookiesFalsas() }));
 */
export const galletas = new Map<string, string>();
export function cookiesFalsas() {
  return {
    get: (k: string) => (galletas.has(k) ? { name: k, value: galletas.get(k) } : undefined),
    set: (k: string, v: string) => void galletas.set(k, v),
  };
}

export async function repoProcesado(): Promise<Repositorio> {
  const repo = await crearRepositorioMemoria("lote-demo-oct");
  await procesarPendientes(repo);
  fijarRepositorio(repo);
  galletas.clear();
  return repo;
}

export async function entradaDe(repo: Repositorio, numero: string): Promise<EntradaRegistro> {
  const e = (await repo.registro({ tipo: ["DECISION_AGENTE"] })).filter((x) => x.factura_numero === numero).at(-1);
  if (!e) throw new Error(`sin entrada para ${numero}`);
  return e;
}

/** ESCALAR sintético: copia de LF-2026-10 con otro monto y otra ref (para límites y doble aprobación). */
export async function escaladaSintetica(repo: Repositorio, usd_centavos: number): Promise<string> {
  const base = await entradaDe(repo, "LF-2026-10");
  const ref = await repo.siguienteRef(2026);
  await repo.agregarEntrada({
    ...base,
    id: await repo.siguienteIdRegistro(2026),
    ref_interna: ref,
    factura_numero: `SINT-${usd_centavos}`,
    monto_original: { centavos: usd_centavos, moneda: "USD" },
    monto_usd_centavos: usd_centavos,
  });
  return ref;
}
