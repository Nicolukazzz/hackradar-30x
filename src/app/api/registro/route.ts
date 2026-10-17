import { z } from "zod";

import { obtenerRepositorio } from "@/repositorio";
import { obtenerRegistro } from "@/servicios/registro";

import { error, manejar, ok } from "../_http";

const Consulta = z.object({
  decision: z.enum(["todas", "pagar", "frenar", "escalar", "humanas"]).optional(),
  actor: z.enum(["agente", "humano"]).optional(),
  q: z.string().max(100).optional(),
});

/** GET /api/registro?decision=&actor=agente|humano&q= (§12): entradas agrupadas por día, más nuevas primero. */
export async function GET(req: Request) {
  try {
    const c = Consulta.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!c.success) return error(400, "Parámetros inválidos: decision todas|pagar|frenar|escalar|humanas, actor agente|humano.");
    return ok(await obtenerRegistro(await obtenerRepositorio(), c.data));
  } catch (e) {
    return manejar(e);
  }
}
