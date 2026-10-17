// Traza de una factura para `/facturas/[ref]` (mismo servicio que GET /api/facturas/:ref, §12).

import { cache } from "react";

import { obtenerRepositorio } from "@/repositorio";
import { obtenerFactura as servicio, type RespuestaFactura } from "@/servicios/facturas";

export type { HitoLineaTiempo, RespuestaFactura } from "@/servicios/facturas";

/** Una sola lectura por petición aunque la pidan generateMetadata y la página (React cache). */
export const obtenerFactura = cache(async (ref: string): Promise<RespuestaFactura | null> => servicio(await obtenerRepositorio(), ref));
