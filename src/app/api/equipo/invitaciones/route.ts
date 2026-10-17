import { obtenerAlmacenEquipo } from "@/equipo";
import { invitar } from "@/equipo/servicio";
import { auditar } from "@/lib/auth/auditoria";
import { conSesion } from "@/lib/auth/ruta";
import { relojSistema } from "@/lib/reloj-sistema";

import { json, manejar, ok } from "../../_http";

/**
 * POST /api/equipo/invitaciones (#51): `{ rol, limite_aprobacion_usd?, correo_esperado?, dias_vigencia? }` →
 * `{ invitacion, enlace }`. El enlace (con el token) solo se devuelve aquí. Solo administradores.
 */
export const POST = conSesion(
  async (req: Request, _ctx, sesion) => {
    try {
      const r = await invitar(await obtenerAlmacenEquipo(), sesion, await json(req), relojSistema().ahora());
      auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/api/equipo/invitaciones", motivo: `invitación ${r.invitacion.id} rol ${r.invitacion.rol}` });
      return ok(r, { status: 201 });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);
