import "server-only";

import { cache } from "react";
import { z } from "zod";

import type { Sesion } from "@/lib/auth/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Única puerta de identidad (issue #25). `getClaims()` verifica la firma del JWT; el rol sale de
// `public.perfiles` (nunca de user_metadata) y se lee en cada request, así un usuario desactivado
// pierde acceso aunque su token siga vivo. El resto del código no llama a Supabase Auth directo.

const esquemaPerfil = z.object({
  rol: z.enum(["tesoreria", "aprobador", "proveedor"]),
  aprobador_id: z.string().nullable(),
  beneficiario_id: z.string().nullable(),
  nombre: z.string(),
  activo: z.boolean(),
});

export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  // RLS: cada usuario solo puede leer su propia fila.
  const { data: fila, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("rol, aprobador_id, beneficiario_id, nombre, activo")
    .eq("id", claims.sub)
    .maybeSingle();
  if (errorPerfil || !fila) return null;
  const perfil = esquemaPerfil.safeParse(fila);
  if (!perfil.success || !perfil.data.activo) return null;

  const { rol, aprobador_id, beneficiario_id, nombre } = perfil.data;
  const correo = typeof claims.email === "string" ? claims.email : "";
  return { usuario_id: claims.sub, correo, rol, aprobador_id, beneficiario_id, nombre };
});
