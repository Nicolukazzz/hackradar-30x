import { z } from "zod";

import { decidir } from "@/aprobaciones/decidir";
import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { ahoraHumano } from "@/servicios/comun";

import { cuerpo, manejar, ok } from "../../_http";
import { aprobadorDeLaCuenta } from "../../_identidad";

// Estricto: un body con `aprobador_id` se rechaza (la identidad sale de la sesión, #25).
const Cuerpo = z.strictObject({
  accion: z.enum(["aprobar", "rechazar"]),
  comentario: z.string().max(1000),
  agregar_a_lista: z.boolean().optional(),
});

/** POST /api/aprobaciones/:ref (§10, §12): aprobar o rechazar una factura escalada. Devuelve la EntradaRegistro nueva. */
export const POST = conSesion(async (req: Request, ctx: RouteContext<"/api/aprobaciones/[ref]">, sesion) => {
  try {
    const { ref } = await ctx.params;
    const body = await cuerpo(req, Cuerpo);
    const repo = await obtenerRepositorio();
    const aprobador = aprobadorDeLaCuenta(sesion);
    const r = await decidir({ ref, ...body, aprobador_id: aprobador.id, aprobador }, { repo, ahora: await ahoraHumano(repo) });
    return ok(r.entrada, { status: 201 });
  } catch (e) {
    return manejar(e);
  }
});
