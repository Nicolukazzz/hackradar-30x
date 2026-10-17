// Quién está decidiendo. Única puerta: NINGUNA ruta lee aprobador_id del body; sale de la sesión de
// Supabase (#25) que `conRol` ya verificó.

import type { Aprobador } from "@/dominio/tipos";
import type { Rol, Sesion } from "@/lib/auth/permisos";
import type { Repositorio } from "@/repositorio/repositorio";

/** Panel interno: tesorería ve y procesa; los aprobadores además deciden. Los proveedores no entran. */
export const PANEL: Rol[] = ["tesoreria", "aprobador"];

/**
 * Ruta de demo (reiniciar el escenario): siempre en desarrollo; en producción solo con DEMO=1.
 * Igual exige sesión del panel (`conRol`).
 */
export function demoActiva(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.DEMO === "1";
}

/** Aprobador de la sesión (rol `aprobador` con `aprobador_id`), o null. */
export async function aprobadorDeLaSesion(sesion: Sesion, repo: Repositorio): Promise<Aprobador | null> {
  if (sesion.rol !== "aprobador" || !sesion.aprobador_id) return null;
  const { aprobadores } = await repo.datosComunes();
  return aprobadores.find((a) => a.id === sesion.aprobador_id) ?? null;
}
