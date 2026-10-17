import { conRol } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { facturasDelProveedor } from "@/servicios/portal";

import { error, manejar, ok } from "../../_http";

/** GET /api/portal/facturas (#12): "Mis facturas" del proveedor de la sesión, sin reglas internas. */
export const GET = conRol(["proveedor"], async (req: Request, _ctx, sesion) => {
  try {
    if (!sesion.beneficiario_id) return error(403, "Tu usuario no está asociado a un proveedor.");
    const repo = await obtenerRepositorio();
    return ok(await facturasDelProveedor(repo, sesion.beneficiario_id, { urlPortal: new URL("/portal", req.url).toString() }));
  } catch (e) {
    return manejar(e);
  }
});
