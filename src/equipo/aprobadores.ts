// Una cuenta del equipo como aprobador de §10 (#51, #106). En producción los aprobadores son solo estas cuentas:
// data/aprobadores.json queda para el dataset de prueba.

import type { Aprobador } from "@/dominio/tipos";
import { NOMBRE_ROL, type Rol } from "@/lib/auth/permisos";

import { firmantes } from "./servicio";
import type { Miembro } from "./tipos";

export type CuentaAprobadora = { usuario_id: string; nombre: string; correo: string; rol: Rol; limite_aprobacion_usd: number | null };

/** El admin es el aprobador principal sin límite (guarda reglas); el aprobador firma hasta su límite. */
export function comoAprobador(c: CuentaAprobadora): Aprobador {
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

/** Miembros activos que hoy pueden firmar, como aprobadores. */
export function aprobadoresDelEquipo(miembros: readonly Miembro[]): Aprobador[] {
  return firmantes(miembros).map(comoAprobador);
}
