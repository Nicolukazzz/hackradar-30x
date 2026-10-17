import { obtenerAlmacenEquipo } from "@/equipo";
import { revocar } from "@/equipo/servicio";
import { auditar } from "@/lib/auth/auditoria";
import { conSesion } from "@/lib/auth/ruta";
import { relojSistema } from "@/lib/reloj-sistema";

import { manejar, ok } from "../../../_http";

/** DELETE /api/equipo/invitaciones/:id (#51): revoca la invitación; el enlace deja de servir. Solo administradores. */
export const DELETE = conSesion(
  async (_req: Request, ctx: RouteContext<"/api/equipo/invitaciones/[id]">, sesion) => {
    try {
      const { id } = await ctx.params;
      await revocar(await obtenerAlmacenEquipo(), id, relojSistema().ahora());
      auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/api/equipo/invitaciones", motivo: `revocó invitación ${id}` });
      return ok({ revocada: true });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);
