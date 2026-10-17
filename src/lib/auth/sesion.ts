import "server-only";

import { cache } from "react";
import { z } from "zod";

import type { Sesion } from "@/lib/auth/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Única puerta de identidad (#25, #49). `getClaims()` verifica la firma del JWT; `public.perfiles` (RLS: cada
// cuenta lee solo su fila) da el nombre visible y `activo`, leído en cada request: una cuenta desactivada pierde
// el acceso aunque su token siga vivo. El resto del código no llama a Supabase Auth directo.

const esquemaPerfil = z.object({ nombre: z.string(), activo: z.boolean() });

export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  // RLS: cada usuario solo puede leer su propia fila.
  const { data: fila, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("nombre, activo")
    .eq("id", claims.sub)
    .maybeSingle();
  if (errorPerfil || !fila) return null;
  const perfil = esquemaPerfil.safeParse(fila);
  if (!perfil.success || !perfil.data.activo) return null;

  const correo = typeof claims.email === "string" ? claims.email : "";
  return { usuario_id: claims.sub, correo, nombre: perfil.data.nombre };
});
