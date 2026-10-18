// Cliente mínimo de la WhatsApp Cloud API (#79) con fetch: enviar un texto y descargar un archivo. Sin librerías.

import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = "https://graph.facebook.com/v25.0";
const TIEMPO_MAXIMO_MS = 20_000;

export interface ClienteWhatsapp {
  enviarMensaje(numero: string, texto: string): Promise<void>;
  /** Bytes del archivo (GET /{media_id} → url → descarga). Lanza si no existe o pesa más que `maximo`. */
  descargarArchivo(media_id: string, maximo: number): Promise<Buffer>;
}

export function crearClienteWhatsapp(token: string, phone_id: string, f: typeof fetch = fetch): ClienteWhatsapp {
  const auth = { authorization: `Bearer ${token}` };
  return {
    async enviarMensaje(numero, texto) {
      const res = await f(`${GRAPH}/${phone_id}/messages`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: numero, type: "text", text: { body: texto, preview_url: false } }),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
      // El token va en la cabecera: nunca se incluye en el mensaje de error.
      if (!res.ok) {
        const datos = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(`WhatsApp messages: ${datos?.error?.message ?? `HTTP ${res.status}`}`);
      }
    },
    async descargarArchivo(media_id, maximo) {
      const meta = await f(`${GRAPH}/${encodeURIComponent(media_id)}`, { headers: auth, signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
      const datos = (await meta.json().catch(() => null)) as { url?: string; file_size?: number } | null;
      if (!meta.ok || !datos?.url) throw new Error(`WhatsApp media: HTTP ${meta.status}`);
      if ((datos.file_size ?? 0) > maximo) throw new Error("archivo demasiado grande");
      // La URL de descarga también exige el token; solo se sigue si es de Meta.
      if (!/^https:\/\/[a-z0-9.-]+\.(fbsbx|facebook|whatsapp)\.(com|net)\//i.test(datos.url)) throw new Error("WhatsApp media: URL inesperada");
      const res = await f(datos.url, { headers: auth, signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
      if (!res.ok) throw new Error(`WhatsApp descarga: HTTP ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.byteLength > maximo) throw new Error("archivo demasiado grande");
      return bytes;
    },
  };
}

/** Cada carácter no ASCII como `\uXXXX` en hex minúscula (pares sustitutos por separado), como lo firma Meta. */
export function escaparUnicode(texto: string): string {
  return texto.replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

function coincide(cuerpo: string, recibida: Buffer, secreto: string): boolean {
  const esperada = Buffer.from(createHmac("sha256", secreto).update(cuerpo, "utf8").digest("hex"));
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

/**
 * X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(cuerpo, app secret). Meta firma la versión con los caracteres no
 * ASCII escapados (`Nicol\u00e1s`) aunque mande el cuerpo con `Nicolás`: se acepta cualquiera de las dos.
 */
export function firmaValida(cuerpo: string, cabecera: string | null, secreto: string): boolean {
  if (!cabecera || !secreto || !cabecera.startsWith("sha256=")) return false;
  const recibida = Buffer.from(cabecera.slice("sha256=".length).toLowerCase());
  if (coincide(cuerpo, recibida, secreto)) return true;
  const escapado = escaparUnicode(cuerpo);
  return escapado !== cuerpo && coincide(escapado, recibida, secreto);
}
