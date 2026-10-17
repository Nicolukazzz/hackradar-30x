// Almacén del equipo del proceso. Las membresías viven siempre en Supabase (como las cuentas), aunque el
// repositorio de facturas sea en memoria. Se guarda en globalThis para sobrevivir a la recarga de `next dev`.

import type { AlmacenEquipo } from "./almacen";

const CLAVE = Symbol.for("hackradar.equipo");
type Global = typeof globalThis & { [CLAVE]?: Promise<AlmacenEquipo> };

async function crear(): Promise<AlmacenEquipo> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const claveSecreta = process.env.SUPABASE_SECRET_KEY;
  if (!url || !claveSecreta) throw new Error("El equipo (#51) necesita NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY");
  const { crearAlmacenEquipoSupabase } = await import("./supabase");
  return crearAlmacenEquipoSupabase({ url, claveSecreta });
}

export function obtenerAlmacenEquipo(): Promise<AlmacenEquipo> {
  const g = globalThis as Global;
  g[CLAVE] ??= crear().catch((e: unknown) => {
    g[CLAVE] = undefined;
    throw e;
  });
  return g[CLAVE];
}

/** Solo tests: usa un almacén concreto. */
export function fijarAlmacenEquipo(a: AlmacenEquipo): void {
  (globalThis as Global)[CLAVE] = Promise.resolve(a);
}
