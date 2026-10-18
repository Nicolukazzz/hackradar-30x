import { timingSafeEqual } from "node:crypto";

import { after } from "next/server";

import { dependenciasCanal } from "@/canales/dependencias";
import { crearClienteTelegram } from "@/canales/telegram/cliente";
import { recibirTelegram, UpdateSchema } from "@/canales/telegram/recibir";
import { crearLimitador } from "@/lib/limite";
import { obtenerRepositorio } from "@/repositorio";

// POST /api/canales/telegram/webhook (#13): Telegram manda aquí cada mensaje al bot. Está en API_PUBLICAS (no hay
// sesión de usuario): se verifica con la cabecera X-Telegram-Bot-Api-Secret-Token que se registró con setWebhook
// (`npm run telegram -- webhook`). Siempre responde 200 a un pedido auténtico y de inmediato: el mensaje se procesa
// después (`after`), porque leer una foto con LLM puede tardar y Telegram reintenta lo que no responde a tiempo. Cada
// update_id se procesa una sola vez (un reintento no entra como factura repetida).

const porChat = crearLimitador({ maximo: 20, ventanaMs: 60_000 });
const vistos = new Set<number>();
const MAX_VISTOS = 5_000;

function primeraVez(id: number): boolean {
  if (vistos.has(id)) return false;
  vistos.add(id);
  if (vistos.size > MAX_VISTOS) vistos.delete(vistos.values().next().value as number);
  return true;
}

function secretoValido(recibido: string | null, esperado: string): boolean {
  if (!recibido || !esperado) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<Response> {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const secreto = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!token || !secreto) return Response.json({ error: "Telegram no está configurado." }, { status: 503 });
  if (!secretoValido(req.headers.get("x-telegram-bot-api-secret-token"), secreto)) return Response.json({ error: "No autorizado." }, { status: 401 });

  const update = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!update.success) return Response.json({ ok: true, ignorado: "update desconocido" });
  const chat = update.data.message ? String(update.data.message.chat.id) : "";
  if (!primeraVez(update.data.update_id)) return Response.json({ ok: true, ignorado: "repetido" });
  if (chat && !porChat.permitir(chat)) return Response.json({ ok: true, ignorado: "demasiados mensajes" });

  const telegram = crearClienteTelegram(token);
  after(async () => {
    try {
      const r = await recibirTelegram(update.data, { ...(await dependenciasCanal(await obtenerRepositorio())), telegram, secreto, confiarChat: true });
      if (r.respuesta && r.chat_id) await telegram.enviarMensaje(r.chat_id, r.respuesta);
      console.info(`telegram: chat …${chat.slice(-4)} → ${r.entrada ? `${r.entrada.ref_interna} ${r.entrada.decision ?? ""}` : `sin documento (${r.ignorado ?? "sin factura"})`}`);
    } catch (e) {
      console.error("telegram:", e instanceof Error ? e.message : e);
    }
  });
  return Response.json({ ok: true });
}
