import { obtenerRepositorio } from "@/repositorio";
import { conSesion } from "@/lib/auth/ruta";
import { ConsultaRegistro, obtenerRegistro } from "@/servicios/registro";

import { error, manejar, ok } from "../_http";

/** GET /api/registro?decision=&actor=agente|humano&q= (§12): entradas agrupadas por día, más nuevas primero. */
export const GET = conSesion(async (req: Request) => {
  try {
    const c = ConsultaRegistro.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!c.success) return error(400, "Parámetros inválidos: decision todas|pagar|frenar|escalar|humanas, actor agente|humano.");
    return ok(await obtenerRegistro(await obtenerRepositorio(), c.data));
  } catch (e) {
    return manejar(e);
  }
});
