// Almacén de enlaces de proveedor del proceso: Supabase si está configurado; si no (desarrollo local), memoria.
// Se guarda en globalThis para sobrevivir a la recarga de `next dev`.

import type { AlmacenEnlaces } from "./almacen";

const CLAVE = Symbol.for("hackradar.enlaces-proveedor");
type Global = typeof globalThis & { [CLAVE]?: Promise<AlmacenEnlaces> };

async function crear(): Promise<AlmacenEnlaces> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const claveSecreta = process.env.SUPABASE_SECRET_KEY;
  if (url && claveSecreta) {
    const { crearAlmacenEnlacesSupabase } = await import("./supabase");
    return crearAlmacenEnlacesSupabase({ url, claveSecreta });
  }
  if (process.env.NODE_ENV === "production") throw new Error("Los enlaces de proveedor (#85) necesitan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY");
  const { crearAlmacenEnlacesMemoria } = await import("./memoria");
  return crearAlmacenEnlacesMemoria();
}

export function obtenerAlmacenEnlaces(): Promise<AlmacenEnlaces> {
  const g = globalThis as Global;
  g[CLAVE] ??= crear().catch((e: unknown) => {
    g[CLAVE] = undefined;
    throw e;
  });
  return g[CLAVE];
}

/** Solo tests: usa un almacén concreto. */
export function fijarAlmacenEnlaces(a: AlmacenEnlaces): void {
  (globalThis as Global)[CLAVE] = Promise.resolve(a);
}
