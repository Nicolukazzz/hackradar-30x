import { ReglasSchema } from "@/dominio/esquemas";
import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { simularReglas } from "@/servicios/reglas";

import { cuerpo, manejar, ok } from "../../_http";

/** POST /api/reglas/simular (§12, §14): corre el set de prueba con estas reglas sin registrar nada. */
export const POST = conSesion(async (req: Request) => {
  try {
    const reglas = await cuerpo(req, ReglasSchema);
    return ok(await simularReglas(await obtenerRepositorio(), reglas));
  } catch (e) {
    return manejar(e);
  }
});
