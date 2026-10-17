import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { entornoPublico } from "@/lib/supabase/entorno";

/**
 * Cliente con la llave secreta (admin). Solo servidor y solo para lo que el usuario no puede hacer por sí mismo:
 * crear la cuenta de un empleado desde su enlace de invitación (#80). Nunca guarda sesión.
 */
export function crearClienteAdmin(): SupabaseClient {
  const { url } = entornoPublico();
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!clave) throw new Error("Falta SUPABASE_SECRET_KEY para crear cuentas");
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}
