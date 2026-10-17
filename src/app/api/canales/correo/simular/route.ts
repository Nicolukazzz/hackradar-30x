import { dependenciasCanal } from "@/canales/dependencias";
import { recibirCorreo } from "@/canales/correo/recibir";
import { MAX_BYTES } from "@/ingesta/limites";
import type { DecisionAgente, DecisionHumana, IdRegla } from "@/dominio/tipos";
import { conSesion } from "@/lib/auth/ruta";
import { crearLimitador } from "@/lib/limite";
import { obtenerRepositorio } from "@/repositorio";

import { cuerpoLimitado } from "../../../_cuerpo";
import { error, manejar, ok } from "../../../_http";
import { demoActiva } from "../../../_identidad";

/**
 * POST /api/canales/correo/simular (#14): recibe un .eml crudo (cuerpo `message/rfc822`) como si hubiera
 * llegado al buzón. Para la demo sin internet y para probar con los .eml del dataset. No envía la respuesta:
 * la devuelve para mostrarla. En desarrollo o con DEMO=1 un From sin resultado de autenticación se acepta (los
 * .eml de prueba no traen Authentication-Results). En producción sin DEMO=1 el remitente nunca se da por
 * verificado: desde #49 cualquiera puede crear una cuenta, y las cabeceras de un .eml subido (incluido un
 * "dmarc=pass") las escribe quien lo sube. R11 escala; nadie hace pagar al agente con un From falso.
 */
/** Respuesta 201: la usa "Recibir factura → Correo" (#66) para no escribir el tipo a mano en el cliente. */
export type RespuestaSimularCorreo = {
  ref_interna: string;
  estado: DecisionAgente | DecisionHumana | null;
  reglas_que_fallaron: IdRegla[];
  explicacion: string;
  respuesta: { texto: string } | null;
};

// Cada correo corre ingesta, extracción (quizás LLM) y motor: mismo tope que la subida de PDF (/api/documentos).
const limitador = crearLimitador({ maximo: 20, ventanaMs: 60_000 });

function opcionesRemitente() {
  return demoActiva() ? { exigirAutenticacion: false } : { exigirAutenticacion: true, confiarCabeceras: false };
}

export const POST = conSesion(async (req: Request, _ctx, sesion) => {
  try {
    if (!limitador.permitir(sesion.usuario_id)) return error(429, "Demasiados correos seguidos. Espera un minuto.");
    const eml = await cuerpoLimitado(req, MAX_BYTES, "El correo supera los 10 MB.");
    if (eml.byteLength === 0) return error(400, "Envía el correo .eml en el cuerpo.");
    const r = await recibirCorreo(eml, { ...(await dependenciasCanal(await obtenerRepositorio())), ...opcionesRemitente() });
    if (r.ignorado !== null) return error(422, `Correo automático ignorado (${r.ignorado}).`);
    return ok<RespuestaSimularCorreo>(
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
