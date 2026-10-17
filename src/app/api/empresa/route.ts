import { EsquemaCambiosEmpresa } from "@/empresa/datos";
import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { ahoraHumano } from "@/servicios/comun";
import { guardarEmpresa } from "@/servicios/empresa";

import { cuerpo, manejar, ok } from "../_http";
import { aprobadorDeLaCuenta } from "../_identidad";

/** GET /api/empresa (#84): datos de la empresa. Cualquier miembro. */
export const GET = conSesion(async () => {
  try {
    return ok(await (await obtenerRepositorio()).empresa());
  } catch (e) {
    return manejar(e);
  }
});

/**
 * PATCH /api/empresa (#84): cambia nombre, jurisdicción y/o países. Solo administradores. Si algo cambió, escribe
 * CAMBIO_EMPRESA en el registro y la devuelve (`entrada`); si no, `entrada: null`.
 */
export const PATCH = conSesion(
  async (req: Request, _ctx, sesion) => {
    try {
      const cambios = await cuerpo(req, EsquemaCambiosEmpresa);
      const repo = await obtenerRepositorio();
      const r = await guardarEmpresa(repo, cambios, aprobadorDeLaCuenta(sesion), await ahoraHumano(repo));
      return ok(r);
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);
