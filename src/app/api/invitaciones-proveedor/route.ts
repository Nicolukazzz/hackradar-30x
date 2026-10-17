import { obtenerAlmacenInvitaciones } from "@/invitaciones";
import { crearInvitacion, listarInvitaciones } from "@/invitaciones/servicio";
import { auditar } from "@/lib/auth/auditoria";
import { conSesion } from "@/lib/auth/ruta";
import { relojSistema } from "@/lib/reloj-sistema";

import { json, manejar, ok } from "../_http";

/** GET /api/invitaciones-proveedor (#28): enlaces para proveedores nuevos, los más nuevos primero, con su estado. */
export const GET = conSesion(async () => {
  try {
    return ok({ invitaciones: await listarInvitaciones(await obtenerAlmacenInvitaciones(), relojSistema().ahora()) });
  } catch (e) {
    return manejar(e);
  }
});

/**
 * POST /api/invitaciones-proveedor (#28): `{ nombre_esperado?, correo_esperado?, dias_vigencia?, usos_max? }` →
 * `{ invitacion, enlace }`. El enlace (con el token) solo se devuelve aquí. Cualquier miembro del equipo: lo que
 * llega por el enlace siempre escala, así que invitar no abre ningún camino a un pago sin persona.
 */
export const POST = conSesion(async (req: Request, _ctx, sesion) => {
  try {
    const r = await crearInvitacion(await obtenerAlmacenInvitaciones(), sesion, await json(req), relojSistema().ahora());
    auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/api/invitaciones-proveedor", motivo: `invitación de proveedor ${r.invitacion.id}` });
    return ok(r, { status: 201 });
  } catch (e) {
    return manejar(e);
  }
});
