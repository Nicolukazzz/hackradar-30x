import { auditar } from "@/lib/auth/auditoria";
import { conSesion } from "@/lib/auth/ruta";
import { relojSistema } from "@/lib/reloj-sistema";
import { obtenerAlmacenEnlaces } from "@/vinculos";
import { revocarEnlace } from "@/vinculos/servicio";

import { manejar, ok } from "../../../_http";

/** DELETE /api/proveedores/enlaces/:id (#85): el enlace deja de servir. Uno ya usado no se revoca (el correo sigue vinculado). */
export const DELETE = conSesion(
  async (_req: Request, ctx: RouteContext<"/api/proveedores/enlaces/[id]">, sesion) => {
    try {
      const { id } = await ctx.params;
      await revocarEnlace(await obtenerAlmacenEnlaces(), id, relojSistema().ahora());
      auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/api/proveedores/enlaces", motivo: `revocó enlace de proveedor ${id}` });
      return ok({ revocado: true });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);
