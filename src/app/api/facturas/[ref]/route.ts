import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { obtenerFactura } from "@/servicios/facturas";

import { error, manejar, ok } from "../../_http";
import { cuentasFirmantes } from "../../_identidad";

/** GET /api/facturas/:ref (§12): traza completa de una factura. */
export const GET = conSesion(async (_req: Request, ctx: RouteContext<"/api/facturas/[ref]">) => {
  try {
    const { ref } = await ctx.params;
    // Con las cuentas firmantes del equipo: misma respuesta que la pantalla (firmas[].cubre).
    const factura = await obtenerFactura(await obtenerRepositorio(), ref, cuentasFirmantes);
    return factura ? ok(factura) : error(404, `No existe la factura ${ref}.`);
  } catch (e) {
    return manejar(e);
  }
});
