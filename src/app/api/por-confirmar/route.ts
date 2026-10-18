import { proveedoresPorConfirmar } from "@/aprobaciones/proveedores-nuevos";
import { remitentesPorConfirmar } from "@/aprobaciones/remitentes";
import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";

import { manejar, ok } from "../_http";

/**
 * GET /api/por-confirmar (2026-10-18): lo que se resuelve con una sola pregunta, aparte de aprobar facturas.
 * `remitentes`: proveedor de la lista que escribió desde un canal no vinculado. `proveedores`: proveedor nuevo invitado.
 */
export const GET = conSesion(async () => {
  try {
    const repo = await obtenerRepositorio();
    const [remitentes, proveedores] = await Promise.all([remitentesPorConfirmar(repo), proveedoresPorConfirmar(repo)]);
    return ok({ remitentes, proveedores });
  } catch (e) {
    return manejar(e);
  }
});
