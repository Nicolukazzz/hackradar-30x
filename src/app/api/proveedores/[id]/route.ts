import { auditar } from "@/lib/auth/auditoria";
import { conSesion } from "@/lib/auth/ruta";
import { relojSistema } from "@/lib/reloj-sistema";
import { obtenerRepositorio } from "@/repositorio";
import { editarProveedor } from "@/servicios/proveedores";

import { json, manejar, ok } from "../../_http";
import { aprobadorDeLaCuenta } from "../../_identidad";

/** PATCH /api/proveedores/:id (#107): reemplaza los datos del proveedor (`EntradaProveedor` completo). Solo administradores. */
export const PATCH = conSesion(
  async (req: Request, ctx: RouteContext<"/api/proveedores/[id]">, sesion) => {
    try {
      const { id } = await ctx.params;
      const b = await editarProveedor(await obtenerRepositorio(), id, await json(req), aprobadorDeLaCuenta(sesion), relojSistema().ahora());
      auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/api/proveedores", motivo: `editó proveedor ${id}` });
      return ok(b);
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);
