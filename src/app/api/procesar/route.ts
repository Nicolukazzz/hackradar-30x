import { conRol } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { procesarPendientes } from "@/servicios/lote";

import { manejar, ok } from "../_http";
import { PANEL } from "../_identidad";

/** POST /api/procesar (§12): "Procesar facturas nuevas". Idempotente: sin pendientes, procesa 0. */
export const POST = conRol(PANEL, async () => {
  try {
    return ok(await procesarPendientes(await obtenerRepositorio()));
  } catch (e) {
    return manejar(e);
  }
});
