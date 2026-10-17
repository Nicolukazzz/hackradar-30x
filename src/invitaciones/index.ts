// Almacén de invitaciones de proveedor del proceso: en Supabase, como las cuentas y el equipo. Se guarda en
// globalThis para sobrevivir a la recarga de `next dev`.

import type { AlmacenInvitaciones } from "./almacen";

const CLAVE = Symbol.for("hackradar.invitaciones-proveedor");
type Global = typeof globalThis & { [CLAVE]?: Promise<AlmacenInvitaciones> };

async function crear(): Promise<AlmacenInvitaciones> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const claveSecreta = process.env.SUPABASE_SECRET_KEY;
  if (!url || !claveSecreta) throw new Error("Las invitaciones de proveedor (#28) necesitan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY");
  const { crearAlmacenInvitacionesSupabase } = await import("./supabase");
  return crearAlmacenInvitacionesSupabase({ url, claveSecreta });
}

export function obtenerAlmacenInvitaciones(): Promise<AlmacenInvitaciones> {
  const g = globalThis as Global;
  g[CLAVE] ??= crear().catch((e: unknown) => {
    g[CLAVE] = undefined;
    throw e;
  });
  return g[CLAVE];
}

/** Solo tests: usa un almacén concreto. */
export function fijarAlmacenInvitaciones(a: AlmacenInvitaciones): void {
  (globalThis as Global)[CLAVE] = Promise.resolve(a);
}
