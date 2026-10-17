// Traza de una factura para `/facturas/[ref]` (mismo servicio que GET /api/facturas/:ref, §12).

import { obtenerRepositorio } from "@/repositorio";
import { obtenerFactura as servicio, type RespuestaFactura } from "@/servicios/facturas";

export type { HitoLineaTiempo, RespuestaFactura } from "@/servicios/facturas";

export async function obtenerFactura(ref: string): Promise<RespuestaFactura | null> {
  return servicio(await obtenerRepositorio(), ref);
}
