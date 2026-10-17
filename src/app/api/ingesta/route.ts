import { conRol } from "@/lib/auth/ruta";

import { error } from "../_http";
import { PANEL } from "../_identidad";

/** POST /api/ingesta (§12): la implementa #11 (ingesta única: ref, remitente, hash, extracción, motor). */
export const POST = conRol(PANEL, async () => {
  return error(501, "La ingesta por API llega con #11. Para la demo, usar Procesar facturas nuevas.");
});
