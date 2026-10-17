import { obtenerAlmacenEquipo } from "@/equipo";
import { obtenerEquipo } from "@/equipo/servicio";
import { conSesion } from "@/lib/auth/ruta";
import { relojSistema } from "@/lib/reloj-sistema";

import { manejar, ok } from "../_http";

/** GET /api/equipo (#51): miembros de la empresa e invitaciones con su estado. Solo administradores. */
export const GET = conSesion(
  async () => {
    try {
      return ok(await obtenerEquipo(await obtenerAlmacenEquipo(), relojSistema().ahora()));
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);
