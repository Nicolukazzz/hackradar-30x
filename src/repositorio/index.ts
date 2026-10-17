// Repositorio único del proceso, elegido por REPOSITORIO=memoria|supabase (por defecto memoria)
// y ESCENARIO (por defecto lote-demo-oct). Se guarda en globalThis para sobrevivir a la recarga
// en caliente de `next dev`.

import { crearRepositorioMemoria } from "./memoria";
import type { Repositorio } from "./repositorio";

export type { Repositorio } from "./repositorio";

const CLAVE = Symbol.for("hackradar.repositorio");
type Global = typeof globalThis & { [CLAVE]?: Promise<Repositorio> };

function crear(): Promise<Repositorio> {
  const tipo = process.env.REPOSITORIO ?? "memoria";
  if (tipo === "supabase") {
    return Promise.reject(new Error("REPOSITORIO=supabase aún no está implementado (#17): usar REPOSITORIO=memoria"));
  }
  return crearRepositorioMemoria(process.env.ESCENARIO ?? "lote-demo-oct");
}

export function obtenerRepositorio(): Promise<Repositorio> {
  const g = globalThis as Global;
  g[CLAVE] ??= crear().catch((e: unknown) => {
    g[CLAVE] = undefined; // que el próximo pedido reintente
    throw e;
  });
  return g[CLAVE];
}

/** Vuelve al estado inicial del escenario (demo). */
export function reiniciarRepositorio(): Promise<Repositorio> {
  (globalThis as Global)[CLAVE] = undefined;
  return obtenerRepositorio();
}

/** Solo tests: usa un repositorio concreto. */
export function fijarRepositorio(r: Repositorio | Promise<Repositorio>): void {
  (globalThis as Global)[CLAVE] = Promise.resolve(r);
}
