// Interfaz intercambiable de LLM (docs/producto.md §4, presupuesto $0) y selección por LLM_PROVIDER.
// Cadena: el elegido → los demás con llave → ninguno. Si uno responde 429/5xx o falla la red,
// se intenta el siguiente. Si responde algo que no valida, se descarta (no se reintenta).

import type { ProveedorLlm } from "@/dominio/tipos";

import { crearAnthropic } from "./anthropic";
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

/** Doble lectura (#58): `extraer()` consulta los dos en paralelo y cruza con el parser (2 de 3). */
export function doble(a: ProveedorLLM, b: ProveedorLLM): ProveedorLLM {
  return {
    nombre: a.nombre,
    modelo: `doble(${a.nombre}:${a.modelo ?? ""}|${b.nombre}:${b.modelo ?? ""})`,
    lectores: [a, b],
    extraer: (doc, faltantes) => a.extraer(doc, faltantes),
  };
}

type Entorno = Record<string, string | undefined>;

/**
 * LLM_PROVIDER=gemini|groq|anthropic|doble|ninguno. Solo entran los proveedores con llave; sin ninguno → `ninguno`
 * (R1 escalará lo que falte). `doble` (#58): Gemini y Claude Haiku leen en paralelo y se cruzan con el parser; si
 * falta uno de los dos, Groq lo reemplaza; si solo queda un lector, se usa la cadena simple.
 */
export function proveedorDesdeEntorno(env: Entorno = process.env, alFallar?: (e: unknown) => void): ProveedorLLM {
  const elegido = (env.LLM_PROVIDER ?? "gemini").trim().toLowerCase();
  if (elegido === "ninguno") return ninguno;
  const disponibles: Partial<Record<ProveedorLlm, () => ProveedorLLM>> = {};
  if (env.GEMINI_API_KEY) disponibles.gemini = () => crearGemini({ apiKey: env.GEMINI_API_KEY ?? "", modelo: env.GEMINI_MODEL });
  if (env.GROQ_API_KEY) disponibles.groq = () => crearGroq({ apiKey: env.GROQ_API_KEY ?? "", modelo: env.GROQ_MODEL });
  if (env.ANTHROPIC_API_KEY) disponibles.anthropic = () => crearAnthropic({ apiKey: env.ANTHROPIC_API_KEY ?? "", modelo: env.ANTHROPIC_MODEL });
  const orden: ProveedorLlm[] = ["gemini", "groq", "anthropic"];
  if (elegido === "doble") {
    // Dos lectores distintos: uno de cada lista, sin repetir proveedor (dos veces el mismo modelo no es independiente).
    const primero = (["gemini", "groq"] as const).find((p) => disponibles[p]);
    const segundo = (["anthropic", "groq"] as const).find((p) => disponibles[p] && p !== primero);
    if (primero && segundo) {
      // Groq respalda solo al primer lector: si respaldara a los dos y ambos cayeran, Groq "coincidiría consigo mismo".
      const respaldo = primero !== "groq" && segundo !== "groq" && disponibles.groq ? [disponibles.groq()] : [];
      return doble(cadena([disponibles[primero]!(), ...respaldo], alFallar), disponibles[segundo]!());
    }
  }
  const primero = orden.find((p) => p === elegido);
  const secuencia = primero ? [primero, ...orden.filter((p) => p !== primero)] : orden;
  return cadena(secuencia.flatMap((p) => disponibles[p]?.() ?? []), alFallar);
}
