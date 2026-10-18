// Interfaz intercambiable de LLM (docs/producto.md §4, presupuesto $0) y selección por LLM_PROVIDER.
// Cadena: el elegido → los demás con llave → ninguno. Si uno responde 429/5xx o falla la red,
// se intenta el siguiente. Si responde algo que no valida, se descarta (no se reintenta).

import type { ProveedorLlm } from "@/dominio/tipos";

import { crearAnthropic } from "./anthropic";
import { ErrorLLM, type ProveedorLLM } from "./contrato";
import { crearGemini, listaDeModelos, modelosGemini } from "./gemini";
import { crearGroq, MODELO_GROQ_POR_DEFECTO } from "./groq";
import { ninguno } from "./ninguno";

export { CONFIANZA_MAXIMA_LLM, ErrorLLM, RespuestaLlmSchema, validarRespuestaLlm, type ProveedorLLM } from "./contrato";

/** Fallo de un proveedor en el log (#93): solo proveedor y motivo, nunca el contenido del documento. */
const registrarFallo = (e: unknown) => console.error(JSON.stringify({ llm: "falló", error: e instanceof Error ? e.message : String(e) }));

/** 429, 5xx o sin respuesta (red, timeout): puede funcionar al reintentar. Un 4xx o una respuesta inválida, no. */
function esPasajero(e: unknown): boolean {
  return e instanceof ErrorLLM && (e.estado === null || e.estado === 429 || e.estado >= 500);
}

export type OpcionesReintento = { intentos?: number; esperaMs?: number; esperar?: (ms: number) => Promise<void> };

/**
 * Reintenta un proveedor ante errores pasajeros (#93): el free tier de Gemini responde 503/429 a ratos y, sin
 * reintento, una factura legible quedaba sin leer (R1 escala con confianza 0 %).
 */
export function conReintento(p: ProveedorLLM, { intentos = 2, esperaMs = 2000, esperar = (ms) => new Promise((r) => setTimeout(r, ms)) }: OpcionesReintento = {}): ProveedorLLM {
  return {
    ...p,
    async extraer(doc, faltantes) {
      for (let i = 1; ; i++) {
        try {
          return await p.extraer(doc, faltantes);
        } catch (e) {
          if (i >= intentos || !esPasajero(e)) throw e;
          registrarFallo(e);
          await esperar(esperaMs);
        }
      }
    },
  };
}

/**
 * Prueba cada proveedor en orden; el primero que responda (aunque sea con algo descartado) gana. Si todos fallan, el
 * parcial lleva `sin_respuesta` (#103): la traza dice que el servicio de lectura no respondió, no "confianza 0 %".
 */
export function cadena(proveedores: ProveedorLLM[], alFallar: (e: unknown) => void = registrarFallo): ProveedorLLM {
  if (proveedores.length === 0) return ninguno;
  return {
    nombre: proveedores[0]?.nombre ?? "ninguno",
    modelo: proveedores.map((p) => `${p.nombre}:${p.modelo ?? ""}`).join(">"),
    async extraer(doc, faltantes) {
      let fallo = "";
      for (const p of proveedores) {
        try {
          return await p.extraer(doc, faltantes);
        } catch (e) {
          alFallar(e);
          fallo = e instanceof Error ? e.message : String(e);
        }
      }
      return { ...(await ninguno.extraer(doc, faltantes)), sin_respuesta: true, ...(fallo ? { fallo } : {}) };
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
  if (env.GEMINI_API_KEY) {
    // Un modelo saturado (503) o retirado (404) no deja la factura sin leer: se prueba el siguiente de la lista.
    const modelos = modelosGemini(env.GEMINI_MODEL).map((modelo) => conReintento(crearGemini({ apiKey: env.GEMINI_API_KEY ?? "", modelo })));
    disponibles.gemini = () => (modelos.length === 1 ? modelos[0]! : cadena(modelos, alFallar));
  }
  if (env.GROQ_API_KEY) {
    // Igual que Gemini: GROQ_MODEL admite una lista y un modelo retirado o saturado pasa al siguiente.
    const modelos = listaDeModelos(env.GROQ_MODEL, [MODELO_GROQ_POR_DEFECTO]).map((modelo) => conReintento(crearGroq({ apiKey: env.GROQ_API_KEY ?? "", modelo })));
    disponibles.groq = () => (modelos.length === 1 ? modelos[0]! : cadena(modelos, alFallar));
  }
  if (env.ANTHROPIC_API_KEY) disponibles.anthropic = () => conReintento(crearAnthropic({ apiKey: env.ANTHROPIC_API_KEY ?? "", modelo: env.ANTHROPIC_MODEL }));
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
