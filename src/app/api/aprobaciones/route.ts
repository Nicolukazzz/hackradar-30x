import { z } from "zod";

import { obtenerRepositorio } from "@/repositorio";
import { conRol } from "@/lib/auth/ruta";
import { obtenerAprobaciones } from "@/servicios/aprobaciones";

import { error, manejar, ok } from "../_http";
import { PANEL } from "../_identidad";

const Consulta = z.object({ orden: z.enum(["vencimiento", "monto"]).optional() });

/** GET /api/aprobaciones?orden=vencimiento|monto (§12) */
export const GET = conRol(PANEL, async (req: Request) => {
  try {
    const c = Consulta.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!c.success) return error(400, "orden debe ser vencimiento o monto.");
    return ok(await obtenerAprobaciones(await obtenerRepositorio(), c.data.orden));
  } catch (e) {
    return manejar(e);
  }
});
