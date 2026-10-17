import { error } from "../_http";

/** POST /api/ingesta (§12): la implementa #11 (ingesta única: ref, remitente, hash, extracción, motor). */
export async function POST() {
  return error(501, "La ingesta por API llega con #11. Para la demo, usar Procesar facturas nuevas.");
}
