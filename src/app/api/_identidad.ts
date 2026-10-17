// Quién está decidiendo. Única puerta: NINGUNA ruta lee aprobador_id del body; sale de la sesión de
// Supabase que `conSesion` ya verificó.

import type { Aprobador } from "@/dominio/tipos";
import type { Sesion } from "@/lib/auth/permisos";

/**
 * Ruta de demo (reiniciar el escenario): siempre en desarrollo; en producción solo con DEMO=1.
 * Igual exige sesión (`conSesion`).
 */
export function demoActiva(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.DEMO === "1";
}

/**
 * #49: sin roles, toda cuenta decide como aprobador principal sin límite, con su propio nombre en el
 * registro. La doble firma (§10) sigue exigiendo dos cuentas distintas. Los aprobadores de
 * data/aprobadores.json (Laura, Andrés) quedan para la asignación y el historial del dataset.
 */
export function aprobadorDeLaCuenta(sesion: Sesion): Aprobador {
  const iniciales =
    sesion.nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";
  // El nombre lo escribe la persona al registrarse: va con su correo (confirmado) para que nadie pase por otro en el registro.
  const nombre = `${sesion.nombre} (${sesion.correo})`;
  return { id: sesion.usuario_id, nombre, rol: "Cuenta", limite_usd: null, principal: true, iniciales };
}
