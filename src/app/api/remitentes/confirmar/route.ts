import { z } from "zod";

import { confirmarRemitente } from "@/aprobaciones/remitentes";
import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { ahoraHumano } from "@/servicios/comun";

import { cuerpo, manejar, ok } from "../../_http";
import { aprobadorDeLaCuenta, cuentasFirmantes } from "../../_identidad";

// Estricto: quién responde sale de la sesión, nunca del body (#25).
const Cuerpo = z.strictObject({
  remitente: z.strictObject({ tipo: z.enum(["correo", "telegram", "whatsapp"]), valor: z.string().min(1).max(320) }),
  beneficiario_id: z.string().min(1).max(80),
  respuesta: z.enum(["si", "no"]),
});

/**
 * POST /api/remitentes/confirmar: «¿este remitente es de este proveedor?». Sí → vincula el canal y vuelve a evaluar sus
 * facturas pendientes (las que cumplen todo se pagan solas). No → las rechaza. Solo administradores: vincular un canal
 * cambia quién puede cobrar (igual que «Vincular» al aprobar, #110).
 */
export const POST = conSesion(
  async (req: Request, _ctx: unknown, sesion) => {
    try {
      const body = await cuerpo(req, Cuerpo);
      const [repo, cuentas] = await Promise.all([obtenerRepositorio(), cuentasFirmantes()]);
      const r = await confirmarRemitente({ ...body, aprobador: aprobadorDeLaCuenta(sesion), cuentas }, { repo, ahora: await ahoraHumano(repo) });
      return ok(r, { status: 201 });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "editar_reglas" },
);
