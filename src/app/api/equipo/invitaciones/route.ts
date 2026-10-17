import { obtenerAlmacenEquipo } from "@/equipo";
import { enviarCorreoInvitacion } from "@/equipo/envio";
import { crearEmpleado } from "@/equipo/servicio";
import { obtenerRepositorio } from "@/repositorio";
import { auditar } from "@/lib/auth/auditoria";
import { conSesion } from "@/lib/auth/ruta";
import { relojSistema } from "@/lib/reloj-sistema";

import { json, manejar, ok } from "../../_http";

/**
 * POST /api/equipo/invitaciones (#51, #80 «Crear empleado»): `{ rol, limite_aprobacion_usd?, correo_esperado, dias_vigencia? }`
 * → `{ invitacion, enlace, correo_enviado }`. Envía el correo formal con el enlace; el enlace (con el token) solo se
 * devuelve aquí, por si el correo no sale. Solo administradores.
 */
export const POST = conSesion(
  async (req: Request, _ctx, sesion) => {
    try {
      const empresa = (await (await obtenerRepositorio()).datosComunes()).empresa.nombre;
      const r = await crearEmpleado(await obtenerAlmacenEquipo(), sesion, await json(req), relojSistema().ahora(), { empresa, enviar: enviarCorreoInvitacion });
      auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/api/equipo/invitaciones", motivo: `invitación ${r.invitacion.id} rol ${r.invitacion.rol} correo ${r.correo_enviado ? "enviado" : "no enviado"}` });
      return ok(r, { status: 201 });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);
