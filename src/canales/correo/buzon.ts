// Buzón real (#14): Gmail del equipo por IMAP (leer) y SMTP (responder), con la clave de aplicación de Google.
// Se usa dentro del proceso web (sondeo.ts) porque el repositorio en memoria vive ahí.

import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

import type { Respuesta } from "./recibir";

export type ConfigBuzon = { usuario: string; clave: string; imapHost: string };

/** null si no hay buzón configurado (desarrollo, tests): el canal queda solo con /simular. */
export function configBuzonDesdeEntorno(env: NodeJS.ProcessEnv = process.env): ConfigBuzon | null {
  const usuario = env.CORREO_IMAP_USUARIO?.trim();
  const clave = env.CORREO_IMAP_CLAVE?.replaceAll(" ", "");
  if (!usuario || !clave) return null;
  return { usuario, clave, imapHost: env.CORREO_IMAP_HOST?.trim() || "imap.gmail.com" };
}

/**
 * Lee los correos no leídos del INBOX y los pasa uno por uno a `procesar`. Cada correo se marca como leído
 * aunque falle (se registra el error): un correo roto no puede trabar el buzón para siempre.
 */
export async function revisarBuzon(config: ConfigBuzon, procesar: (eml: Buffer) => Promise<void>): Promise<number> {
  const cliente = new ImapFlow({
    host: config.imapHost,
    port: 993,
    secure: true,
    auth: { user: config.usuario, pass: config.clave },
    logger: false,
  });
  await cliente.connect();
  let procesados = 0;
  const candado = await cliente.getMailboxLock("INBOX");
  try {
    const uids = (await cliente.search({ seen: false }, { uid: true })) || [];
    for (const uid of uids) {
      const mensaje = await cliente.fetchOne(String(uid), { source: true }, { uid: true });
      try {
        if (mensaje && mensaje.source) {
          await procesar(mensaje.source);
          procesados++;
        }
      } catch (e) {
        console.error(JSON.stringify({ canal: "correo", uid, error: e instanceof Error ? e.message : String(e) }));
      } finally {
        await cliente.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      }
    }
  } finally {
    candado.release();
    await cliente.logout();
  }
  return procesados;
}

export async function enviarRespuesta(config: ConfigBuzon, r: Respuesta): Promise<void> {
  const transporte = nodemailer.createTransport({ service: "gmail", auth: { user: config.usuario, pass: config.clave } });
  await transporte.sendMail({
    from: config.usuario,
    to: r.para,
    subject: r.asunto,
    text: r.texto,
    ...(r.en_respuesta_a ? { inReplyTo: r.en_respuesta_a, references: [r.en_respuesta_a] } : {}),
  });
}
