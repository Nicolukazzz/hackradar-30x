import { remitentesPorConfirmar } from "@/aprobaciones/remitentes";
import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";

import { manejar, ok } from "../_http";

/** GET /api/remitentes: remitentes no vinculados de proveedores de la lista, con sus facturas pendientes (2026-10-18). */
export const GET = conSesion(async () => {
  try {
    return ok({ remitentes: await remitentesPorConfirmar(await obtenerRepositorio()) });
  } catch (e) {
    return manejar(e);
  }
});
