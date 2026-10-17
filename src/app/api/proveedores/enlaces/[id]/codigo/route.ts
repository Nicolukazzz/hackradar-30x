import { auditar } from "@/lib/auth/auditoria";
import { conSesion } from "@/lib/auth/ruta";
import { relojSistema } from "@/lib/reloj-sistema";
import { obtenerAlmacenEnlaces } from "@/vinculos";
import { cambiarCodigo } from "@/vinculos/servicio";

import { json, manejar, ok } from "../../../../_http";

/**
 * POST /api/proveedores/enlaces/:id/codigo (#85): `{ codigo }` → `{ codigo }`. Cambia el código del proveedor: el
 * anterior deja de servir y su sesión abierta se cierra. Solo administradores.
 */
export const POST = conSesion(
  async (req: Request, ctx: RouteContext<"/api/proveedores/enlaces/[id]/codigo">, sesion) => {
    try {
      const { id } = await ctx.params;
      const r = await cambiarCodigo(await obtenerAlmacenEnlaces(), id, await json(req), relojSistema().ahora());
      auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/api/proveedores/enlaces", motivo: `cambió el código del enlace ${id}` });
      return ok(r);
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);
