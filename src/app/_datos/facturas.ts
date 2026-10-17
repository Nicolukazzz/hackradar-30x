// Traza de una factura para `/facturas/[ref]` (mismo servicio que GET /api/facturas/:ref, §12).

import { cache } from "react";

import { cuentasFirmantes } from "@/app/api/_identidad";
import { obtenerRepositorio } from "@/repositorio";
import { obtenerFactura as servicio, type RespuestaFactura } from "@/servicios/facturas";

export type { HitoLineaTiempo, RespuestaFactura } from "@/servicios/facturas";

/** Una sola lectura por petición aunque la pidan generateMetadata y la página (React cache). */
export const obtenerFactura = cache(
  // Mismas cuentas firmantes que POST /api/aprobaciones/:ref; solo se cargan si la factura tiene firmas parciales.
  async (ref: string): Promise<RespuestaFactura | null> => servicio(await obtenerRepositorio(), ref, cuentasFirmantes),
);
