import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { novedades } from "@/servicios/verificar";

import { manejar, ok } from "../../_http";

/** GET /api/bandeja/novedades: `{ total, ultima }` de decisiones del agente, para que la Bandeja se actualice sola. */
export const GET = conSesion(
  async () => {
    try {
      return ok(await novedades(await obtenerRepositorio()));
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "ver" },
);
