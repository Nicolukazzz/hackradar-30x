import { timingSafeEqual } from "node:crypto";

import { after } from "next/server";

import { dependenciasCanal } from "@/canales/dependencias";
import { crearClienteWhatsapp, firmaValida } from "@/canales/whatsapp/cliente";
import { mensajesDe, recibirWhatsapp, WebhookSchema } from "@/canales/whatsapp/recibir";
import { crearLimitador } from "@/lib/limite";
import { obtenerRepositorio } from "@/repositorio";

// /api/canales/whatsapp/webhook (#79). Está en API_PUBLICAS (no hay sesión de usuario).
// GET: verificación de Meta al registrar el webhook (hub.verify_token = WHATSAPP_VERIFY_TOKEN → devuelve hub.challenge).
// POST: cada mensaje al número. Se verifica X-Hub-Signature-256 con WHATSAPP_APP_SECRET sobre el cuerpo crudo, se
// responde 200 de inmediato y se procesa después (`after`): Meta reintenta si tarda, y una factura reintentada
// llegaría como duplicada. Por lo mismo, cada id de mensaje se procesa una sola vez.

const porNumero = crearLimitador({ maximo: 20, ventanaMs: 60_000 });
const vistos = new Set<string>();
const MAX_VISTOS = 5_000;

function primeraVez(id: string): boolean {
  if (vistos.has(id)) return false;
  vistos.add(id);
  if (vistos.size > MAX_VISTOS) vistos.delete(vistos.values().next().value as string);
  return true;
}

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(req: Request): Promise<Response> {
  const verify = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
  const q = new URL(req.url).searchParams;
  const challenge = q.get("hub.challenge") ?? "";
  if (!verify || q.get("hub.mode") !== "subscribe" || !iguales(q.get("hub.verify_token") ?? "", verify) || !/^[\w-]{1,200}$/.test(challenge)) {
    return new Response("No autorizado.", { status: 403 });
  }
  return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
}

export async function POST(req: Request): Promise<Response> {
  const token = process.env.WHATSAPP_TOKEN ?? "";
  const phone = process.env.WHATSAPP_PHONE_ID ?? "";
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
  const verify = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
  if (!token || !phone || !appSecret || !verify) return Response.json({ error: "WhatsApp no está configurado." }, { status: 503 });
  const crudo = await req.text();
  if (!firmaValida(crudo, req.headers.get("x-hub-signature-256"), appSecret)) return Response.json({ error: "No autorizado." }, { status: 401 });

  let json: unknown = null;
  try {
    json = JSON.parse(crudo);
  } catch {
    return Response.json({ ok: true, ignorado: "cuerpo inválido" });
  }
  const webhook = WebhookSchema.safeParse(json);
  if (!webhook.success) return Response.json({ ok: true, ignorado: "evento desconocido" });
  const mensajes = mensajesDe(webhook.data).filter((m) => primeraVez(m.id) && porNumero.permitir(m.from));

  after(async () => {
    const whatsapp = crearClienteWhatsapp(token, phone);
    for (const m of mensajes) {
      try {
        const r = await recibirWhatsapp(m, {
          ...(await dependenciasCanal(await obtenerRepositorio())),
          whatsapp,
          secreto: `whatsapp:${verify}`,
          confiarNumero: true,
        });
        if (r.respuesta) await whatsapp.enviarMensaje(r.numero, r.respuesta);
      } catch (e) {
        console.error("whatsapp:", e instanceof Error ? e.message : e);
      }
    }
  });
  return Response.json({ ok: true, mensajes: mensajes.length });
}
