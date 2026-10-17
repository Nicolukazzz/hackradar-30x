import { obtenerAlmacenInvitaciones } from "@/invitaciones";
import { revocarInvitacion } from "@/invitaciones/servicio";
import { auditar } from "@/lib/auth/auditoria";
import { conSesion } from "@/lib/auth/ruta";
import { relojSistema } from "@/lib/reloj-sistema";

import { manejar, ok } from "../../_http";

/** DELETE /api/invitaciones-proveedor/:id (#28): revoca el enlace; deja de servir al instante. */
export const DELETE = conSesion(async (_req: Request, ctx: RouteContext<"/api/invitaciones-proveedor/[id]">, sesion) => {
  try {
    const { id } = await ctx.params;
    await revocarInvitacion(await obtenerAlmacenInvitaciones(), id, relojSistema().ahora());
    auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/api/invitaciones-proveedor", motivo: `revocó invitación de proveedor ${id}` });
    return ok({ revocada: true });
  } catch (e) {
    return manejar(e);
  }
});
