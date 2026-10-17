import { z } from "zod";

import { obtenerRepositorio } from "@/repositorio";
import { conRol } from "@/lib/auth/ruta";
import { obtenerBandeja } from "@/servicios/bandeja";

import { error, manejar, ok } from "../_http";
import { PANEL } from "../_identidad";

const Consulta = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  decision: z.enum(["todas", "pagar", "frenar", "escalar"]).optional(),
  q: z.string().max(100).optional(),
});

/** GET /api/bandeja?periodo=2026-10&decision=todas&q= (§12) */
export const GET = conRol(PANEL, async (req: Request) => {
  try {
    const c = Consulta.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!c.success) return error(400, "Parámetros inválidos: decision es todas|pagar|frenar|escalar y periodo AAAA-MM.");
    const bandeja = await obtenerBandeja(await obtenerRepositorio(), c.data);
    // Por ahora hay un solo periodo cargado (el del escenario).
    if (c.data.periodo && c.data.periodo !== bandeja.periodo) return error(404, `No hay datos del periodo ${c.data.periodo}.`);
    return ok(bandeja);
  } catch (e) {
    return manejar(e);
  }
});
