import { auditar } from "@/lib/auth/auditoria";
import { conSesion } from "@/lib/auth/ruta";
import { relojSistema } from "@/lib/reloj-sistema";
import { obtenerRepositorio } from "@/repositorio";
import { obtenerAlmacenEnlaces } from "@/vinculos";
import { crearEnlace, listarEnlaces } from "@/vinculos/servicio";

import { json, manejar, ok } from "../../_http";

/** GET /api/proveedores/enlaces (#85): enlaces de proveedor, los más nuevos primero, con su estado. Solo administradores. */
export const GET = conSesion(
  async () => {
    try {
      return ok({ enlaces: await listarEnlaces(await obtenerAlmacenEnlaces(), relojSistema().ahora()) });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);

/**
 * POST /api/proveedores/enlaces (#85): `{ nombre, correo, codigo }` → `{ enlace, url, codigo }`. La URL (con el token)
 * y el código solo se devuelven aquí: el admin se los pasa al proveedor. Solo administradores.
 */
export const POST = conSesion(
  async (req: Request, _ctx, sesion) => {
    try {
      const r = await crearEnlace(await obtenerAlmacenEnlaces(), await obtenerRepositorio(), sesion, await json(req), relojSistema().ahora());
      auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/api/proveedores/enlaces", motivo: `portal de proveedor ${r.enlace.id} (${r.enlace.beneficiario_id ?? "nuevo"})` });
      return ok(r, { status: 201 });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);
