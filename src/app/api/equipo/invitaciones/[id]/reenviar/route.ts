import { obtenerAlmacenEquipo } from "@/equipo";
import { reenviar } from "@/equipo/servicio";
import { auditar } from "@/lib/auth/auditoria";
import { conSesion } from "@/lib/auth/ruta";
import { relojSistema } from "@/lib/reloj-sistema";

import { manejar, ok } from "../../../../_http";

/** POST /api/equipo/invitaciones/:id/reenviar (#80): revoca el enlace y devuelve uno nuevo para el mismo correo. Solo administradores. */
export const POST = conSesion(
  async (_req: Request, ctx: RouteContext<"/api/equipo/invitaciones/[id]/reenviar">, sesion) => {
    try {
      const { id } = await ctx.params;
      const r = await reenviar(await obtenerAlmacenEquipo(), sesion, id, relojSistema().ahora());
      auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/api/equipo/invitaciones", motivo: `reenvió invitación ${id} → ${r.invitacion.id}` });
      return ok(r, { status: 201 });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);
