// Cliente mínimo de la Bot API de Telegram (#13) con fetch: enviar un mensaje y descargar un archivo. Sin librerías.

const API = "https://api.telegram.org";
const TIEMPO_MAXIMO_MS = 20_000;

/** Lo que se usa de la Bot API: enviar un mensaje y descargar un archivo. */
export interface ClienteTelegram {
  enviarMensaje(chat_id: string, texto: string): Promise<void>;
  /** Bytes del archivo (getFile + descarga). Lanza si no existe o pesa más que `maximo`. */
  descargarArchivo(file_id: string, maximo: number): Promise<Buffer>;
}

/** Cliente con `fetch` y tiempo máximo por llamada. Lanza si la API responde error. */
export function crearClienteTelegram(token: string, f: typeof fetch = fetch): ClienteTelegram {
  const metodo = async <T>(nombre: string, cuerpo: Record<string, unknown>): Promise<T> => {
    const res = await f(`${API}/bot${token}/${nombre}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
    const datos = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
    // El token va en la URL: nunca se incluye en el mensaje de error.
    if (!res.ok || !datos?.ok) throw new Error(`Telegram ${nombre}: ${datos?.description ?? `HTTP ${res.status}`}`);
    return datos.result as T;
  };
  return {
    async enviarMensaje(chat_id, texto) {
      await metodo("sendMessage", { chat_id, text: texto, link_preview_options: { is_disabled: true } });
    },
    async descargarArchivo(file_id, maximo) {
      const archivo = await metodo<{ file_path?: string; file_size?: number }>("getFile", { file_id });
      if (!archivo.file_path) throw new Error("Telegram getFile: sin file_path");
      if ((archivo.file_size ?? 0) > maximo) throw new Error("archivo demasiado grande");
      const res = await f(`${API}/file/bot${token}/${archivo.file_path}`, { signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
      if (!res.ok) throw new Error(`Telegram descarga: HTTP ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.byteLength > maximo) throw new Error("archivo demasiado grande");
      return bytes;
    },
  };
}
