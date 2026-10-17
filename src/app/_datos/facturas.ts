// Traza de una factura para `/facturas/[ref]` (mismo servicio que GET /api/facturas/:ref, §12).

import { cache } from "react";

import { aprobadorDeMiembro } from "@/app/api/_identidad";
import { obtenerAlmacenEquipo } from "@/equipo";
import { firmantes } from "@/equipo/servicio";
import { EMPRESA_ID } from "@/equipo/tipos";
import { obtenerRepositorio } from "@/repositorio";
import { obtenerFactura as servicio, type RespuestaFactura } from "@/servicios/facturas";

export type { HitoLineaTiempo, RespuestaFactura } from "@/servicios/facturas";

/** Una sola lectura por petición aunque la pidan generateMetadata y la página (React cache). */
export const obtenerFactura = cache(async (ref: string): Promise<RespuestaFactura | null> => {
  const [repo, almacen] = await Promise.all([obtenerRepositorio(), obtenerAlmacenEquipo()]);
  // Mismas cuentas firmantes que POST /api/aprobaciones/:ref, para que el panel sepa si la primera firma cubre el monto.
  const cuentas = firmantes(await almacen.miembros(EMPRESA_ID)).map(aprobadorDeMiembro);
  return servicio(repo, ref, cuentas);
});
