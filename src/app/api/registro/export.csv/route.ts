import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { registroACsv } from "@/servicios/registro";

import { manejar } from "../../_http";

/** GET /api/registro/export.csv (§9): 15 columnas. BOM para que Excel lea bien las tildes. */
export const GET = conSesion(async () => {
  try {
    const entradas = await (await obtenerRepositorio()).registro();
    return new Response("﻿" + registroACsv(entradas), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="registro.csv"' },
    });
  } catch (e) {
    return manejar(e);
  }
});
