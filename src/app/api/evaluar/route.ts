import { z } from "zod";

import { ExtraccionSchema } from "@/dominio/esquemas";
import { conRol } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { evaluarSinRegistrar } from "@/servicios/evaluar";

import { cuerpo, manejar, ok } from "../_http";
import { PANEL } from "../_identidad";

const Cuerpo = z.strictObject({ extraccion: ExtraccionSchema, beneficiario_id: z.string().min(1).optional() });

/**
 * POST /api/evaluar (§12): "¿qué decidiría el agente con esta factura?" para otros agentes.
 * Simulación: corre el motor contra el registro actual y no escribe nada.
 */
export const POST = conRol(PANEL, async (req: Request) => {
  try {
    const body = await cuerpo(req, Cuerpo);
    return ok(await evaluarSinRegistrar(await obtenerRepositorio(), body.extraccion, body.beneficiario_id));
  } catch (e) {
    return manejar(e);
  }
});
