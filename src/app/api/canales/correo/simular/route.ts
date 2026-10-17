import { dependenciasCanal } from "@/canales/dependencias";
import { recibirCorreo } from "@/canales/correo/recibir";
import { MAX_BYTES } from "@/ingesta/limites";
import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";

import { cuerpoLimitado } from "../../../_cuerpo";
import { error, manejar, ok } from "../../../_http";

/**
 * POST /api/canales/correo/simular (#14): recibe un .eml crudo (cuerpo `message/rfc822`) como si hubiera
 * llegado al buzón. Para la demo sin internet y para probar con los .eml del dataset. No envía la respuesta:
 * la devuelve para mostrarla. El .eml lo sube alguien del panel: un From sin resultado de autenticación se
 * acepta (los .eml de prueba no traen Authentication-Results); un fail explícito igual escala.
 */
export const POST = conSesion(async (req: Request) => {
  try {
    const eml = await cuerpoLimitado(req, MAX_BYTES, "El correo supera los 10 MB.");
    if (eml.byteLength === 0) return error(400, "Envía el correo .eml en el cuerpo.");
    const r = await recibirCorreo(eml, { ...(await dependenciasCanal(await obtenerRepositorio())), exigirAutenticacion: false });
    if (r.ignorado !== null) return error(422, `Correo automático ignorado (${r.ignorado}).`);
    return ok(
      {
        ref_interna: r.entrada.ref_interna,
        estado: r.entrada.decision,
        reglas_que_fallaron: r.entrada.reglas_que_fallaron,
        explicacion: r.entrada.explicacion,
        respuesta: r.respuesta,
      },
      { status: 201 },
    );
  } catch (e) {
    return manejar(e);
  }
});
