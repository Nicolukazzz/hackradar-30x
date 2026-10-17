// Buzón real (#14): Gmail del equipo por IMAP (leer) y SMTP (responder), con la clave de aplicación de Google.
// Se usa dentro del proceso web (sondeo.ts) porque el repositorio en memoria vive ahí.

import { ImapFlow } from "imapflow";
import nodemailer, { type Transporter } from "nodemailer";

import type { Respuesta } from "./recibir";

export type ConfigBuzon = { usuario: string; clave: string; imapHost: string };

/** Etiqueta de Gmail que marca lo ya procesado. No se usa \Seen: una persona puede leer el buzón sin que se pierdan facturas. */
export const ETIQUETA_PROCESADO = "blinka-procesado";

/** null si no hay buzón configurado (desarrollo, tests): el canal queda solo con /simular. */
export function configBuzonDesdeEntorno(env: NodeJS.ProcessEnv = process.env): ConfigBuzon | null {
  const usuario = env.CORREO_IMAP_USUARIO?.trim();
  const clave = env.CORREO_IMAP_CLAVE?.replaceAll(" ", "");
  if (!usuario || !clave) return null;
  return { usuario, clave, imapHost: env.CORREO_IMAP_HOST?.trim() || "imap.gmail.com" };
}

const registrar = (datos: Record<string, unknown>) => console.error(JSON.stringify({ canal: "correo", ...datos }));

/**
 * Lee los correos de INBOX sin la etiqueta de procesado (últimos 7 días) y los pasa uno por uno a `procesar`.
 * La etiqueta se pone ANTES de procesar: un correo se procesa como mucho una vez, aunque el proceso se
 * reinicie a mitad (si falla, queda en el log y finanzas lo ve en Gmail). Nunca lanza hacia afuera.
 */
export async function revisarBuzon(config: ConfigBuzon, procesar: (eml: Buffer) => Promise<void>): Promise<number> {
  const cliente = new ImapFlow({
    host: config.imapHost,
    port: 993,
    secure: true,
    auth: { user: config.usuario, pass: config.clave },
    logger: false,
  });
  // Sin este listener, un error de socket después de conectar es un evento sin manejar y tumba el servidor.
  cliente.on("error", (e: Error) => registrar({ error: `imap: ${e.message}` }));

  let procesados = 0;
  try {
    await cliente.connect();
    const candado = await cliente.getMailboxLock("INBOX");
    try {
      const uids = (await cliente.search({ gmraw: `in:inbox -label:${ETIQUETA_PROCESADO} newer_than:7d` }, { uid: true })) || [];
      for (const uid of uids) {
        try {
          await cliente.messageFlagsAdd(String(uid), [ETIQUETA_PROCESADO], { uid: true, useLabels: true });
          const mensaje = await cliente.fetchOne(String(uid), { source: true }, { uid: true });
          if (mensaje && mensaje.source) {
            await procesar(mensaje.source);
            procesados++;
          }
        } catch (e) {
          registrar({ uid, error: e instanceof Error ? e.message : String(e) });
        }
      }
    } finally {
      candado.release();
    }
  } catch (e) {
    registrar({ error: e instanceof Error ? e.message : String(e) });
  } finally {
    await cliente.logout().catch(() => cliente.close());
  }
  return procesados;
}

/** Un solo transporte SMTP por sondeo (no una conexión nueva por respuesta). */
export function crearTransporte(config: ConfigBuzon): Transporter {
  return nodemailer.createTransport({ service: "gmail", pool: true, auth: { user: config.usuario, pass: config.clave } });
}

export async function enviarRespuesta(transporte: Transporter, config: ConfigBuzon, r: Respuesta): Promise<void> {
  await transporte.sendMail({
    from: config.usuario,
    to: r.para,
    subject: r.asunto,
    text: r.texto,
    headers: { "Auto-Submitted": "auto-replied" }, // RFC 3834: los otros bots no nos responden
    ...(r.en_respuesta_a ? { inReplyTo: r.en_respuesta_a, references: [r.en_respuesta_a] } : {}),
  });
}
