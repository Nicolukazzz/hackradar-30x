import { z } from "zod";

import { dependenciasCanal } from "@/canales/dependencias";
import { MensajeSchema, recibirWhatsapp } from "@/canales/whatsapp/recibir";
import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";

import { cuerpo, manejar, ok } from "../../../_http";
import { demoActiva } from "../../../_identidad";

const Cuerpo = z.strictObject({
  mensaje: MensajeSchema,
  /** archivos del mensaje por media id, en base64 (no hay Graph API de dónde bajarlos) */
  archivos: z.record(z.string().max(300), z.string().max(15_000_000)).optional(),
});

/**
 * POST /api/canales/whatsapp/simular (#79): procesa un mensaje de WhatsApp como si hubiera llegado al webhook, para la
 * demo sin Meta. No envía la respuesta: la devuelve. En producción sin DEMO=1 el número lo escribió quien llama: el
 * remitente queda sin verificar (R11 escala) y VINCULAR y ESTADO no se aceptan.
 */
export const POST = conSesion(async (req: Request) => {
  try {
    const { mensaje, archivos = {} } = await cuerpo(req, Cuerpo);
    const whatsapp = {
      async descargarArchivo(id: string) {
        const b64 = archivos[id];
        if (!b64) throw new Error("archivo no incluido");
        return Buffer.from(b64, "base64");
      },
    };
    const r = await recibirWhatsapp(mensaje, {
      ...(await dependenciasCanal(await obtenerRepositorio())),
      whatsapp,
      secreto: `whatsapp:${process.env.WHATSAPP_VERIFY_TOKEN ?? ""}`,
      confiarNumero: demoActiva(),
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
