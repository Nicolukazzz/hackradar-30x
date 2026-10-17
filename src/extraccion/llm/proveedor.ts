// Interfaz intercambiable de LLM (docs/producto.md §4, presupuesto $0) y selección por LLM_PROVIDER.
// Cadena: el elegido → los demás con llave → ninguno. Si uno responde 429/5xx o falla la red,
// se intenta el siguiente. Si responde algo que no valida, se descarta (no se reintenta).

import type { ProveedorLlm } from "@/dominio/tipos";

import type { ProveedorLLM } from "./contrato";
import { crearGemini } from "./gemini";
import { crearGroq } from "./groq";
import { ninguno } from "./ninguno";

export { CONFIANZA_MAXIMA_LLM, ErrorLLM, RespuestaLlmSchema, validarRespuestaLlm, type ProveedorLLM } from "./contrato";

/** Prueba cada proveedor en orden; el primero que responda (aunque sea con algo descartado) gana. */
export function cadena(proveedores: ProveedorLLM[], alFallar?: (e: unknown) => void): ProveedorLLM {
  if (proveedores.length === 0) return ninguno;
  return {
    nombre: proveedores[0]?.nombre ?? "ninguno",
    modelo: proveedores.map((p) => `${p.nombre}:${p.modelo ?? ""}`).join(">"),
    async extraer(doc, faltantes) {
      for (const p of proveedores) {
        try {
          return await p.extraer(doc, faltantes);
        } catch (e) {
          alFallar?.(e);
        }
      }
      return ninguno.extraer(doc, faltantes);
    },
  };
}

type Entorno = Record<string, string | undefined>;

/**
 * LLM_PROVIDER=gemini|groq|ninguno (anthropic aún no implementado: se usan los demás).
 * Solo entran a la cadena los proveedores con llave. Sin ninguno → `ninguno` (R1 escalará lo que falte).
 */
export function proveedorDesdeEntorno(env: Entorno = process.env, alFallar?: (e: unknown) => void): ProveedorLLM {
  const elegido = (env.LLM_PROVIDER ?? "gemini").trim().toLowerCase();
  if (elegido === "ninguno") return ninguno;
  const disponibles: Partial<Record<ProveedorLlm, () => ProveedorLLM>> = {};
  if (env.GEMINI_API_KEY) disponibles.gemini = () => crearGemini({ apiKey: env.GEMINI_API_KEY ?? "", modelo: env.GEMINI_MODEL });
  if (env.GROQ_API_KEY) disponibles.groq = () => crearGroq({ apiKey: env.GROQ_API_KEY ?? "", modelo: env.GROQ_MODEL });
  const orden: ProveedorLlm[] = ["gemini", "groq"];
  const primero = orden.find((p) => p === elegido);
  const secuencia = primero ? [primero, ...orden.filter((p) => p !== primero)] : orden;
  return cadena(secuencia.flatMap((p) => disponibles[p]?.() ?? []), alFallar);
}
