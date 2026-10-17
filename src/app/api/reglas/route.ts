import { ReglasSchema } from "@/dominio/esquemas";
import { obtenerRepositorio } from "@/repositorio";
import { ahoraHumano } from "@/servicios/comun";
import { guardarReglas, obtenerReglas, sinVersion } from "@/servicios/reglas";

import { error, json, manejar, ok, validar } from "../_http";
import { aprobadorDeLaPeticion } from "@/app/_datos/identidad";

/** GET /api/reglas (§12): versión vigente, historial, beneficiarios, aprobadores y tasas. */
export async function GET() {
  try {
    return ok(await obtenerReglas(await obtenerRepositorio()));
  } catch (e) {
    return manejar(e);
  }
}

/**
 * POST /api/reglas (§12): guarda una versión nueva ("Guardar como v8"). Cuerpo: Reglas sin `version`
 * (editada_por y editada_en los pone el servidor). Solo el aprobador principal; 409 si la simulación
 * da algún pago fuera de reglas.
 */
export async function POST(req: Request) {
  try {
    const repo = await obtenerRepositorio();
    const autor = await aprobadorDeLaPeticion(repo);
    if (!autor) return error(401, "Elige con qué aprobador actúas antes de guardar reglas.");
    const ahora = await ahoraHumano(repo);
    const actual = await repo.reglasVigentes();
    const crudo = await json(req);
    if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) return error(400, "El cuerpo debe ser un objeto Reglas.");
    // Mismo esquema que data/reglas/*.json (R9 ≤ R6, solo R5/R8 desactivables…). version y autoría las pone el servidor.
    const reglas = validar(ReglasSchema, { ...crudo, version: actual.version + 1, editada_por: autor.nombre, editada_en: ahora });
    const r = await guardarReglas(repo, sinVersion(reglas), autor, ahora);
    return ok({ version: r.version, reporte: r.reporte }, { status: 201 });
  } catch (e) {
    return manejar(e);
  }
}
