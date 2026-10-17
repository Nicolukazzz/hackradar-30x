// Quién está decidiendo. Única puerta: NINGUNA ruta lee aprobador_id del body; sale de la sesión de
// Supabase que `conSesion` ya verificó (con el permiso de su rol, #51).

import type { Aprobador } from "@/dominio/tipos";
import type { Miembro } from "@/equipo/tipos";
import { NOMBRE_ROL, type Rol, type Sesion } from "@/lib/auth/permisos";

/**
 * Ruta de demo (reiniciar el escenario): siempre en desarrollo; en producción solo con DEMO=1.
 * Igual exige sesión de administrador.
 */
export function demoActiva(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.DEMO === "1";
}

type Cuenta = { usuario_id: string; nombre: string; correo: string; rol: Rol; limite_aprobacion_usd: number | null };

/**
 * Una cuenta de la empresa como aprobador de §10. El admin es el aprobador principal sin límite (guarda reglas);
 * el aprobador firma hasta su límite. Los aprobadores de data/aprobadores.json (Laura, Andrés) quedan para la
 * asignación y el historial del dataset.
 */
function comoAprobador(c: Cuenta): Aprobador {
  const iniciales =
    c.nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";
  // El nombre lo escribe la persona al registrarse: va con su correo (confirmado) para que nadie pase por otro en el registro.
  const nombre = c.correo ? `${c.nombre} (${c.correo})` : c.nombre;
  const admin = c.rol === "admin";
  return {
    id: c.usuario_id,
    nombre,
    rol: NOMBRE_ROL[c.rol],
    limite_usd: admin ? null : c.limite_aprobacion_usd,
    principal: admin,
    iniciales,
  };
}

/** La cuenta de la sesión. Solo para rutas que ya exigieron el permiso (`aprobar` o `editar_reglas`). */
export function aprobadorDeLaCuenta(sesion: Sesion): Aprobador {
  if (sesion.rol === null) throw new Error("aprobadorDeLaCuenta sin rol: la ruta debe exigir permiso con conSesion");
  return comoAprobador({ ...sesion, rol: sesion.rol });
}

export function aprobadorDeMiembro(m: Miembro): Aprobador {
  return comoAprobador(m);
}
