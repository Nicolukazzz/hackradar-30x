// Claude Haiku 5.5 (segundo lector de la doble lectura, #58) con el SDK oficial. Lee imagen y PDF de forma nativa.
// Haiku 5.5 no acepta `temperature` (400) y piensa por defecto: se pide esfuerzo bajo (extraer no necesita razonar
// mucho) y la salida se valida con el mismo zod que Gemini y Groq. Modelo configurable con ANTHROPIC_MODEL.

import Anthropic from "@anthropic-ai/sdk";

import type { DocumentoNormalizado } from "../tipos";
import { textoCrudo } from "../normalizar";
import { ErrorLLM, validarRespuestaLlm, type ProveedorLLM } from "./contrato";
import { mensajeUsuario, PROMPT_SISTEMA } from "./prompt";

export const MODELO_ANTHROPIC_POR_DEFECTO = "claude-haiku-5-5";
const TIEMPO_MAXIMO_MS = 60_000;
const IMAGENES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/** Llave, modelo y cliente inyectable (tests). */
export type OpcionesAnthropic = { apiKey: string; modelo?: string; cliente?: Pick<Anthropic, "messages"> };

/** Documento (PDF) e imágenes primero, después el texto con los campos pedidos. */
function contenido(doc: DocumentoNormalizado, texto: string): Anthropic.ContentBlockParam[] {
  const archivos: Anthropic.ContentBlockParam[] = doc.visuales.flatMap((v): Anthropic.ContentBlockParam[] => {
    const data = v.bytes.toString("base64");
    if (v.mime === "application/pdf") return [{ type: "document", source: { type: "base64", media_type: "application/pdf", data } }];
    if (IMAGENES.has(v.mime)) {
      return [{ type: "image", source: { type: "base64", media_type: v.mime as "image/png" | "image/jpeg" | "image/gif" | "image/webp", data } }];
    }
    return [];
  });
  return [...archivos, { type: "text", text: texto }];
}

/** Lector Claude Haiku. Devuelve un parcial validado o lanza `ErrorLLM` si el error es pasajero. */
export function crearAnthropic(op: OpcionesAnthropic): ProveedorLLM {
  const modelo = op.modelo || MODELO_ANTHROPIC_POR_DEFECTO;
  // Sin reintentos del SDK: la cadena de proveedores pasa al siguiente lector (Groq) si este falla.
  const cliente = op.cliente ?? new Anthropic({ apiKey: op.apiKey, maxRetries: 0, timeout: TIEMPO_MAXIMO_MS });
  return {
    nombre: "anthropic",
    modelo,
    async extraer(doc, faltantes) {
      const texto = mensajeUsuario(textoCrudo(doc), faltantes, doc.visuales.length > 0);
      let r: Anthropic.Message;
      try {
        r = await cliente.messages.create({
          model: modelo,
          max_tokens: 16000,
          system: PROMPT_SISTEMA,
          output_config: { effort: "low" },
          messages: [{ role: "user", content: contenido(doc, texto) }],
        });
      } catch (e) {
        // 429, 5xx, 529 (sobrecarga), red o llave inválida: el siguiente proveedor de la cadena responde.
        const estado = e instanceof Anthropic.APIError && typeof e.status === "number" ? e.status : null;
        throw new ErrorLLM("anthropic", e instanceof Error ? e.message : String(e), estado);
      }
      // Rechazo o respuesta cortada: no hay datos confiables (R1 escalará lo que falte).
      if (r.stop_reason === "refusal" || r.stop_reason === "max_tokens") return { proveedor_llm: "anthropic" };
      const salida = r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      return (salida && validarRespuestaLlm(salida, "anthropic")) || { proveedor_llm: "anthropic" };
    },
  };
}
