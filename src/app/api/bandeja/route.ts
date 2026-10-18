import { z } from "zod";

import { obtenerRepositorio } from "@/repositorio";
import { conSesion } from "@/lib/auth/ruta";
import { obtenerBandeja } from "@/servicios/bandeja";

import { error, manejar, ok } from "../_http";

const Consulta = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  decision: z.enum(["todas", "pagar", "frenar", "escalar"]).optional(),
  q: z.string().max(100).optional(),
});

/** GET /api/bandeja?periodo=2026-10&decision=todas&q= (§12) */
export const GET = conSesion(async (req: Request) => {
  try {
    const c = Consulta.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!c.success) return error(400, "Parámetros inválidos: decision es todas|pagar|frenar|escalar y periodo AAAA-MM.");
    // `periodo` filtra por el mes en que se recibieron las facturas (#119).
    const bandeja = await obtenerBandeja(await obtenerRepositorio(), { decision: c.data.decision, q: c.data.q, mes: c.data.periodo });
    if (c.data.periodo && !bandeja.meses.includes(c.data.periodo)) return error(404, `No hay facturas del periodo ${c.data.periodo}.`);
    return ok(bandeja);
  } catch (e) {
    return manejar(e);
  }
});
