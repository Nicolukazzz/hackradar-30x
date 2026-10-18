import { z } from "zod";

import { dependenciasCanal } from "@/canales/dependencias";
import { recibirTelegram, UpdateSchema } from "@/canales/telegram/recibir";
import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";

import { cuerpo, manejar, ok } from "../../../_http";
import { confiarRemitenteSimulado } from "../../../_identidad";

const Cuerpo = z.strictObject({
  update: UpdateSchema,
  /** archivos del mensaje por file_id, en base64 (no hay Bot API de dónde bajarlos) */
  archivos: z.record(z.string().max(300), z.string().max(15_000_000)).optional(),
});

/**
 * POST /api/canales/telegram/simular (#13): procesa un Update de Telegram como si hubiera llegado al bot, para la
 * demo sin bot y los fixtures del dataset. No envía la respuesta: la devuelve. Fuera de modo demo, o si quien llama no es administrador, el chat lo
 * escribió quien llama: el remitente queda sin verificar (R11 escala) y /start y /estado no se aceptan.
 */
export const POST = conSesion(async (req: Request, _ctx, sesion) => {
  try {
    const { update, archivos = {} } = await cuerpo(req, Cuerpo);
    const telegram = {
      async descargarArchivo(file_id: string) {
        const b64 = archivos[file_id];
        if (!b64) throw new Error("archivo no incluido");
        return Buffer.from(b64, "base64");
      },
    };
    const r = await recibirTelegram(update, {
      ...(await dependenciasCanal(await obtenerRepositorio())),
      telegram,
      secreto: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
      confiarChat: confiarRemitenteSimulado(sesion),
    });
    return ok(
      {
        respuesta: r.respuesta,
        ref_interna: r.entrada?.ref_interna ?? null,
        estado: r.entrada?.decision ?? null,
        reglas_que_fallaron: r.entrada?.reglas_que_fallaron ?? [],
        explicacion: r.entrada?.explicacion ?? null,
      },
      { status: r.entrada ? 201 : 200 },
    );
  } catch (e) {
    return manejar(e);
  }
});
