import { obtenerRepositorio } from "@/repositorio";
import { obtenerFactura } from "@/servicios/facturas";

import { error, manejar, ok } from "../../_http";

/** GET /api/facturas/:ref (§12): traza completa de una factura. */
export async function GET(_req: Request, ctx: RouteContext<"/api/facturas/[ref]">) {
  try {
    const { ref } = await ctx.params;
    const factura = await obtenerFactura(await obtenerRepositorio(), ref);
    return factura ? ok(factura) : error(404, `No existe la factura ${ref}.`);
  } catch (e) {
    return manejar(e);
  }
}
