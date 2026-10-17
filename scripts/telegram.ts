// Telegram (#13) desde la terminal:
//   npm run telegram -- webhook              registra el webhook del bot en la URL pública, con el secret
//   npm run telegram -- enlace <beneficiario> imprime el enlace t.me para vincular el chat de un proveedor
// Variables: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_BOT_USUARIO y RAILWAY_PUBLIC_DOMAIN o URL_PUBLICA.

import { crearTokenVinculo } from "@/canales/telegram/vinculo";
import { urlPublica } from "@/lib/url-publica";

async function main() {
  const [accion, beneficiario] = process.argv.slice(2);
  const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const secreto = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (accion === "webhook") {
    if (!token || !secreto) throw new Error("Faltan TELEGRAM_BOT_TOKEN y TELEGRAM_WEBHOOK_SECRET");
    const url = urlPublica("/api/canales/telegram/webhook");
    if (!url.startsWith("https://")) throw new Error(`Telegram exige https: ${url} (define URL_PUBLICA o RAILWAY_PUBLIC_DOMAIN)`);
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, secret_token: secreto, allowed_updates: ["message"], drop_pending_updates: true }),
    });
    const r = (await res.json()) as { ok: boolean; description?: string };
    if (!r.ok) throw new Error(`setWebhook: ${r.description ?? res.status}`);
    console.log(`Webhook registrado: ${url}`);
    return;
  }
  if (accion === "enlace" && beneficiario) {
    const bot = process.env.TELEGRAM_BOT_USUARIO?.replace(/^@/, "");
    if (!bot) throw new Error("Falta TELEGRAM_BOT_USUARIO (el @usuario del bot, sin @)");
    console.log(`https://t.me/${bot}?start=${crearTokenVinculo(beneficiario, new Date().toISOString(), secreto)}`);
    console.log("Un solo uso, vence en 72 h. Envíaselo al proveedor por un medio que ya conozcas.");
    return;
  }
  console.error("Uso: npm run telegram -- webhook | enlace <beneficiario_id>");
  process.exit(1);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
