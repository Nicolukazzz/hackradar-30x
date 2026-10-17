// Gemini Flash (free tier) por REST: lee imagen y PDF de forma nativa y responde JSON.
// Sin SDK para no sumar dependencias. Modelo configurable con GEMINI_MODEL.

import type { DocumentoNormalizado } from "../tipos";
import { textoCrudo } from "../normalizar";
import { ErrorLLM, validarRespuestaLlm, type ProveedorLLM } from "./contrato";
import { mensajeUsuario, PROMPT_SISTEMA } from "./prompt";

export const MODELO_GEMINI_POR_DEFECTO = "gemini-flash-latest";
const URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TIEMPO_MAXIMO_MS = 30_000;

export type OpcionesProveedorHttp = { apiKey: string; modelo?: string; fetch?: typeof fetch };

function partes(doc: DocumentoNormalizado, texto: string) {
  return [
    { text: texto },
    ...doc.visuales.map((v) => ({ inline_data: { mime_type: v.mime, data: v.bytes.toString("base64") } })),
  ];
}

export function crearGemini(op: OpcionesProveedorHttp): ProveedorLLM {
  const modelo = op.modelo || MODELO_GEMINI_POR_DEFECTO;
  const f = op.fetch ?? fetch;
  return {
    nombre: "gemini",
    modelo,
    async extraer(doc, faltantes) {
      const texto = mensajeUsuario(textoCrudo(doc), faltantes, doc.visuales.length > 0);
      let res: Response;
      try {
        res = await f(`${URL_BASE}/${encodeURIComponent(modelo)}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": op.apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: PROMPT_SISTEMA }] },
            contents: [{ role: "user", parts: partes(doc, texto) }],
            generationConfig: { responseMimeType: "application/json", temperature: 0 },
          }),
          signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
        });
      } catch (e) {
        throw new ErrorLLM("gemini", e instanceof Error ? e.message : String(e));
      }
      if (!res.ok) throw new ErrorLLM("gemini", `HTTP ${res.status}`, res.status);
      const cuerpo: unknown = await res.json().catch(() => null);
      const salida = (cuerpo as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null)
        ?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
      return (salida && validarRespuestaLlm(salida, "gemini")) || { proveedor_llm: "gemini" };
    },
  };
}
