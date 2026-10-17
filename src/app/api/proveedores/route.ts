import { auditar } from "@/lib/auth/auditoria";
import { conSesion } from "@/lib/auth/ruta";
import { relojSistema } from "@/lib/reloj-sistema";
import { obtenerRepositorio } from "@/repositorio";
import { crearProveedor, listarProveedores } from "@/servicios/proveedores";

import { json, manejar, ok } from "../_http";
import { aprobadorDeLaCuenta } from "../_identidad";

/** GET /api/proveedores (#107): proveedores a los que el agente puede pagar, por nombre. Cualquier miembro del panel. */
export const GET = conSesion(
  async () => {
    try {
      return ok({ proveedores: await listarProveedores(await obtenerRepositorio()) });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "ver" },
);

/** POST /api/proveedores (#107): crea un proveedor (`EntradaProveedor`) y escribe CAMBIO_BENEFICIARIOS. Solo administradores. */
export const POST = conSesion(
  async (req: Request, _ctx, sesion) => {
    try {
      const b = await crearProveedor(await obtenerRepositorio(), await json(req), aprobadorDeLaCuenta(sesion), relojSistema().ahora());
      auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/api/proveedores", motivo: `creó proveedor ${b.id}` });
      return ok(b, { status: 201 });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);
