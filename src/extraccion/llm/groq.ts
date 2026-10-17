// Groq (free tier, respaldo): API compatible con OpenAI, Llama 4 Scout multimodal.
// Acepta imágenes pero no PDF: un PDF escaneado no se le puede mostrar (queda faltante y R1 escala).

import { textoCrudo } from "../normalizar";
import { ErrorLLM, validarRespuestaLlm, type ProveedorLLM } from "./contrato";
import type { OpcionesProveedorHttp } from "./gemini";
import { mensajeUsuario, PROMPT_SISTEMA } from "./prompt";

export const MODELO_GROQ_POR_DEFECTO = "meta-llama/llama-4-scout-17b-16e-instruct";
const URL = "https://api.groq.com/openai/v1/chat/completions";
const TIEMPO_MAXIMO_MS = 30_000;

export function crearGroq(op: OpcionesProveedorHttp): ProveedorLLM {
  const modelo = op.modelo || MODELO_GROQ_POR_DEFECTO;
  const f = op.fetch ?? fetch;
  return {
    nombre: "groq",
    modelo,
    async extraer(doc, faltantes) {
      const imagenes = doc.visuales.filter((v) => v.mime.startsWith("image/"));
      const texto = mensajeUsuario(textoCrudo(doc), faltantes, imagenes.length > 0);
      let res: Response;
      try {
        res = await f(URL, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${op.apiKey}` },
          body: JSON.stringify({
            model: modelo,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: PROMPT_SISTEMA },
              {
                role: "user",
                content: [
                  { type: "text", text: texto },
                  ...imagenes.map((v) => ({
                    type: "image_url",
                    image_url: { url: `data:${v.mime};base64,${v.bytes.toString("base64")}` },
                  })),
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
        });
      } catch (e) {
        throw new ErrorLLM("groq", e instanceof Error ? e.message : String(e));
      }
      if (!res.ok) throw new ErrorLLM("groq", `HTTP ${res.status}`, res.status);
      const cuerpo: unknown = await res.json().catch(() => null);
      const salida = (cuerpo as { choices?: { message?: { content?: string } }[] } | null)?.choices?.[0]?.message?.content;
      return (salida && validarRespuestaLlm(salida, "groq")) || { proveedor_llm: "groq" };
    },
  };
}
