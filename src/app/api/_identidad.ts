// Quién está decidiendo. Única puerta: NINGUNA ruta lee aprobador_id del body; sale de la sesión de
// Supabase que `conSesion` ya verificó (con el permiso de su rol, #51).

import type { Aprobador } from "@/dominio/tipos";
import { obtenerAlmacenEquipo } from "@/equipo";
import { aprobadoresDelEquipo, comoAprobador } from "@/equipo/aprobadores";
import { EMPRESA_ID, type Miembro } from "@/equipo/tipos";
import type { Sesion } from "@/lib/auth/permisos";

/**
 * Ruta de demo (reiniciar el escenario): siempre en desarrollo; en producción solo con DEMO=1.
 * Igual exige sesión de administrador.
 */
export function demoActiva(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.DEMO === "1";
}

/** La cuenta de la sesión. Solo para rutas que ya exigieron el permiso (`aprobar` o `editar_reglas`). */
export function aprobadorDeLaCuenta(sesion: Sesion): Aprobador {
  if (sesion.rol === null) throw new Error("aprobadorDeLaCuenta sin rol: la ruta debe exigir permiso con conSesion");
  return comoAprobador({ ...sesion, rol: sesion.rol });
}

export function aprobadorDeMiembro(m: Miembro): Aprobador {
  return comoAprobador(m);
}

/**
 * Cuentas del equipo que hoy pueden firmar una aprobación (§10, #51), como aprobadores. Una sola fuente para
 * POST /api/aprobaciones/:ref (decidir) y la Traza (`firmas[].cubre`), así nunca dicen cosas distintas.
 */
export async function cuentasFirmantes(): Promise<Aprobador[]> {
  const almacen = await obtenerAlmacenEquipo();
  return aprobadoresDelEquipo(await almacen.miembros(EMPRESA_ID));
}
