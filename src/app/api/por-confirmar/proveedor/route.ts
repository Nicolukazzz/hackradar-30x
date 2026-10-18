import { z } from "zod";

import { confiarEnProveedor } from "@/aprobaciones/proveedores-nuevos";
import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { ahoraHumano } from "@/servicios/comun";

import { cuerpo, manejar, ok } from "../../_http";
import { aprobadorDeLaCuenta, cuentasFirmantes } from "../../_identidad";

// Estricto: quién responde sale de la sesión, nunca del body (#25).
const Cuerpo = z.strictObject({ clave: z.string().min(1).max(200), respuesta: z.enum(["si", "no"]) });

/**
 * POST /api/por-confirmar/proveedor: «¿confiar siempre en este proveedor nuevo?». Sí → lo agrega a la lista y aprueba las
 * facturas que escalaron solo por ser nuevo (con el límite de quien responde). No → rechaza sus facturas pendientes.
 * Solo administradores: agregar a la lista cambia a quién se le puede pagar.
 */
export const POST = conSesion(
  async (req: Request, _ctx: unknown, sesion) => {
    try {
      const body = await cuerpo(req, Cuerpo);
      const [repo, cuentas] = await Promise.all([obtenerRepositorio(), cuentasFirmantes()]);
      const r = await confiarEnProveedor({ ...body, aprobador: aprobadorDeLaCuenta(sesion), cuentas }, { repo, ahora: await ahoraHumano(repo) });
      return ok(r, { status: 201 });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "editar_reglas" },
);
