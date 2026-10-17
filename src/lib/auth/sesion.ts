import "server-only";

import { cache } from "react";
import { z } from "zod";

import { EMPRESA_ID } from "@/equipo/tipos";
import { ROLES, type Sesion } from "@/lib/auth/permisos";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Única puerta de identidad (#25, #49, #51). `getClaims()` verifica la firma del JWT; `public.perfiles` da el
// nombre visible y `activo`, y `public.membresias` el rol en la empresa (RLS: cada cuenta lee solo sus filas).
// Se leen en cada request: una cuenta desactivada o a la que le quitan el rol pierde el acceso aunque su token
// siga vivo. El resto del código no llama a Supabase Auth directo.

const esquemaPerfil = z.object({ nombre: z.string(), activo: z.boolean() });
const esquemaMembresia = z.object({ rol: z.enum(ROLES), limite_aprobacion_usd: z.number().int().positive().nullable() });

export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const [perfilRes, membresiaRes] = await Promise.all([
    supabase.from("perfiles").select("nombre, activo").eq("id", claims.sub).maybeSingle(),
    supabase
      .from("membresias")
      .select("rol, limite_aprobacion_usd")
      .eq("usuario_id", claims.sub)
      .eq("empresa_id", EMPRESA_ID)
      .maybeSingle(),
  ]);
  if (perfilRes.error || !perfilRes.data) return null;
  const perfil = esquemaPerfil.safeParse(perfilRes.data);
  if (!perfil.success || !perfil.data.activo) return null;
  // Si la membresía no se pudo leer, la cuenta queda sin rol (fallar hacia seguro: no ve nada, no decide nada).
  const membresia = membresiaRes.error ? null : esquemaMembresia.safeParse(membresiaRes.data);

  const correo = typeof claims.email === "string" ? claims.email : "";
  return {
    usuario_id: claims.sub,
    correo,
    nombre: perfil.data.nombre,
    rol: membresia?.success ? membresia.data.rol : null,
    limite_aprobacion_usd: membresia?.success ? membresia.data.limite_aprobacion_usd : null,
  };
});
