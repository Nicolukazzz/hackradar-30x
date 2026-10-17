import { conRol } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";

import { manejar } from "../../_http";
import { PANEL } from "../../_identidad";

/** GET /api/registro/export.json (§9): el registro completo, en orden de inserción. */
export const GET = conRol(PANEL, async () => {
  try {
    const entradas = await (await obtenerRepositorio()).registro();
    return new Response(JSON.stringify(entradas, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8", "content-disposition": 'attachment; filename="registro.json"' },
    });
  } catch (e) {
    return manejar(e);
  }
});
