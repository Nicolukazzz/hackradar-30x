import { auditar } from "@/lib/auth/auditoria";
import { conSesion } from "@/lib/auth/ruta";
import { relojSistema } from "@/lib/reloj-sistema";
import { obtenerAlmacenEnlaces } from "@/vinculos";
import { borrarEnlace, revocarEnlace } from "@/vinculos/servicio";

import { manejar, ok } from "../../../_http";

/**
 * DELETE /api/proveedores/enlaces/:id (#85): revoca el acceso (deja de servir al instante).
 * DELETE …?definitivo=1 (#119): borra para siempre un acceso ya revocado o vencido. Solo administradores.
 */
export const DELETE = conSesion(
  async (req: Request, ctx: RouteContext<"/api/proveedores/enlaces/[id]">, sesion) => {
    try {
      const { id } = await ctx.params;
      if (new URL(req.url).searchParams.get("definitivo") === "1") {
        await borrarEnlace(await obtenerAlmacenEnlaces(), id, relojSistema().ahora());
        auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/api/proveedores/enlaces", motivo: `borró enlace de proveedor ${id}` });
        return ok({ borrado: true });
      }
      await revocarEnlace(await obtenerAlmacenEnlaces(), id, relojSistema().ahora());
      auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/api/proveedores/enlaces", motivo: `revocó enlace de proveedor ${id}` });
      return ok({ revocado: true });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);
