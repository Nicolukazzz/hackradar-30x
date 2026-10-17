import { z } from "zod";

import { decidir } from "@/aprobaciones/decidir";
import { obtenerRepositorio } from "@/repositorio";
import { ahoraHumano } from "@/servicios/comun";

import { cuerpo, error, manejar, ok } from "../../_http";
import { aprobadorDeLaPeticion } from "../../_identidad";

// Estricto: un body con `aprobador_id` se rechaza (la identidad sale de la sesión, #25).
const Cuerpo = z.strictObject({
  accion: z.enum(["aprobar", "rechazar"]),
  comentario: z.string().max(1000),
  agregar_a_lista: z.boolean().optional(),
});

/** POST /api/aprobaciones/:ref (§10, §12): aprobar o rechazar una factura escalada. Devuelve la EntradaRegistro nueva. */
export async function POST(req: Request, ctx: RouteContext<"/api/aprobaciones/[ref]">) {
  try {
    const { ref } = await ctx.params;
    const body = await cuerpo(req, Cuerpo);
    const repo = await obtenerRepositorio();
    const aprobador = await aprobadorDeLaPeticion(repo);
    if (!aprobador) return error(401, "Elige con qué aprobador actúas antes de decidir.");
    const r = await decidir({ ref, ...body, aprobador_id: aprobador.id }, { repo, ahora: await ahoraHumano(repo) });
    return ok(r.entrada, { status: 201 });
  } catch (e) {
    return manejar(e);
  }
}
