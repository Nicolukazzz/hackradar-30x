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
  const escenario = process.env.ESCENARIO ?? "lote-demo-oct";
  if (tipo === "supabase") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const claveSecreta = process.env.SUPABASE_SECRET_KEY;
    if (!url || !claveSecreta) return Promise.reject(new Error("REPOSITORIO=supabase necesita NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY"));
    return import("./supabase").then((m) => m.crearRepositorioSupabase({ url, claveSecreta, escenario }));
  }
  return crearRepositorioMemoria(escenario);
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
