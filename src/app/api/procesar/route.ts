import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { procesarPendientes } from "@/servicios/lote";

import { manejar, ok } from "../_http";

/** POST /api/procesar (§12): "Procesar facturas nuevas". Idempotente: sin pendientes, procesa 0. */
export const POST = conSesion(async () => {
  try {
    return ok(await procesarPendientes(await obtenerRepositorio()));
  } catch (e) {
    return manejar(e);
  }
});
