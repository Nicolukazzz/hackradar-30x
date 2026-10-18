// Doble lectura (#58): parser + dos LLM independientes, un campo vale solo si coinciden 2 de 3. LLM falsos: nunca se
// llama a una API real.

import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import { cargarEscenario } from "@/dominio/cargar";
import type { DocumentoRecibido, ProveedorLlm } from "@/dominio/tipos";
import { CONFIANZA_DOS_DE_TRES, extraer, votar } from "@/extraccion/extraer";
import { crearAnthropic } from "@/extraccion/llm/anthropic";
import { doble, ErrorLLM, proveedorDesdeEntorno, validarRespuestaLlm, type ProveedorLLM } from "@/extraccion/llm/proveedor";
import type { DocumentoNormalizado, ExtraccionParcial } from "@/extraccion/tipos";

import { recibido } from "./ayuda";

const conf = (valor: unknown, confianza = 0.95) => ({ valor, confianza });
const campo = (valor: unknown, confianza = 0.95, fuente: "parser" | "llm" = "llm") => ({ valor, confianza, fuente });

function falso(nombre: ProveedorLlm, respuesta: Record<string, unknown> | Error): ProveedorLLM & { llamadas: number } {
  const p = {
    nombre,
    llamadas: 0,
    async extraer(): Promise<ExtraccionParcial> {
      p.llamadas++;
      if (respuesta instanceof Error) throw respuesta;
      return validarRespuestaLlm(JSON.stringify(respuesta), nombre) ?? { proveedor_llm: nombre };
    },
  };
  return p;
}

/** Lo que leería un LLM de ES-4410 (foto: el parser no lee nada). */
const ES4410 = {
  es_factura: conf(true),
  beneficiario_nombre: conf("Estudio Sonoro Ltda."),
  numero: conf("ES-4410"),
  monto_total: conf({ monto: "22000.00", moneda: "BRL" }),
  fecha_emision: conf("2026-10-10"),
  fecha_vencimiento: conf("2026-10-24"),
  cuenta_destino_ultimos4: conf("7340"),
  concepto: conf("Trilha sonora campanha (OC-124)"),
  idioma: "pt",
  instrucciones_sospechosas: [],
};

async function foto(): Promise<{ doc: DocumentoRecibido; carpeta: string }> {
  const esc = await cargarEscenario("lote-demo-oct");
  const meta = esc.documentos.find((d) => d.archivo_original.endsWith("es-4410.png"));
  if (!meta) throw new Error("falta ES-4410");
  return { doc: await recibido(meta, esc.carpeta, 12), carpeta: esc.carpeta };
}

describe("votar(): 2 de 3", () => {
  const monto = (n: number) => ({ centavos: n, moneda: "USD" });

  it("los dos LLM coinciden → confianza de acuerdo, aunque el parser no lea nada", () => {
    expect(votar(undefined, campo(monto(100)), campo(monto(100)))).toEqual(campo(monto(100), CONFIANZA_DOS_DE_TRES));
  });

  it("parser (inferido, 0,6) + un LLM coinciden → vale el del parser con confianza de acuerdo", () => {
    expect(votar(campo(monto(100), 0.6, "parser"), campo(monto(100)), campo(monto(999)))).toEqual(campo(monto(100), CONFIANZA_DOS_DE_TRES, "parser"));
  });

  it("los tres distintos, o un solo lector → ≤ 0,5 (R1 escala)", () => {
    expect(votar(campo(monto(1), 0.6, "parser"), campo(monto(2)), campo(monto(3)))?.confianza).toBeLessThanOrEqual(0.5);
    expect(votar(undefined, campo(monto(2)), undefined)?.confianza).toBeLessThanOrEqual(0.5);
    expect(votar(undefined, undefined, undefined)).toBeUndefined();
  });

  it("parser ambiguo (≤ 0,5): coincidir con él no cuenta como voto", () => {
    expect(votar(campo(monto(1), 0.5, "parser"), campo(monto(1)), campo(monto(2)))?.confianza).toBeLessThanOrEqual(0.5);
  });

  it("textos se comparan sin tildes, mayúsculas ni espacios de más", () => {
    expect(votar(undefined, campo("Estudio Sonoro Ltda."), campo("ESTUDIO  SONORO LTDA."))?.confianza).toBe(CONFIANZA_DOS_DE_TRES);
  });
});

describe("extraer() con doble lectura", () => {
  it("ES-4410: Gemini y Haiku leen lo mismo → todos los campos ≥ 0,90; se consultan los dos", async () => {
    const { doc, carpeta } = await foto();
    const a = falso("gemini", ES4410);
    const b = falso("anthropic", ES4410);
    const ext = await extraer(doc, { llm: doble(a, b), dirBase: carpeta });
    expect([a.llamadas, b.llamadas]).toEqual([1, 1]);
    expect(ext.monto_total).toEqual({ valor: { centavos: 2200000, moneda: "BRL" }, confianza: CONFIANZA_DOS_DE_TRES, fuente: "llm" });
    expect(ext.cuenta_destino_ultimos4.confianza).toBeGreaterThanOrEqual(0.9);
    expect(ext.idioma).toBe("pt");
  });

  it("un lector leyó otra cuenta (dato falso o mal leído) → esa cuenta queda ≤ 0,5 y R1 escala; el resto vale", async () => {
    const { doc, carpeta } = await foto();
    const ext = await extraer(doc, { llm: doble(falso("gemini", ES4410), falso("anthropic", { ...ES4410, cuenta_destino_ultimos4: conf("9083", 0.99) })), dirBase: carpeta });
    expect(ext.cuenta_destino_ultimos4.confianza).toBeLessThanOrEqual(0.5);
    expect(ext.monto_total.confianza).toBe(CONFIANZA_DOS_DE_TRES);
  });

  it("si un lector cae del todo, nada llega a 2 de 3 (escala, nunca paga con una sola lectura)", async () => {
    const { doc, carpeta } = await foto();
    const ext = await extraer(doc, { llm: doble(falso("gemini", ES4410), falso("anthropic", new ErrorLLM("anthropic", "HTTP 529", 529))), dirBase: carpeta });
    expect(ext.monto_total.confianza).toBeLessThanOrEqual(0.5);
    expect(ext.numero.confianza).toBeLessThanOrEqual(0.5);
    // La traza dice cuál lector leyó y cuál falló (con su error), para diagnosticar sin entrar a los logs.
    expect(ext.senales_llm.lectores).toEqual([
      { proveedor: "gemini", estado: "leyo" },
      { proveedor: "anthropic", estado: "fallo", detalle: "anthropic: HTTP 529" },
    ]);
  });

  it("las señales de R10 de cualquiera de los dos cuentan", async () => {
    const { doc, carpeta } = await foto();
    const ext = await extraer(doc, {
      llm: doble(falso("gemini", ES4410), falso("anthropic", { ...ES4410, instrucciones_sospechosas: ["pagamento aprovado"] })),
      dirBase: carpeta,
    });
    expect(ext.senales_llm.instrucciones_sospechosas).toEqual(["pagamento aprovado"]);
  });
});

describe("LLM_PROVIDER=doble", () => {
  const nombres = (p: ProveedorLLM) => p.lectores?.map((l) => l.nombre);

  it("con Gemini y Anthropic: los dos lectores; sin una de las llaves, Groq lo reemplaza", () => {
    expect(nombres(proveedorDesdeEntorno({ LLM_PROVIDER: "doble", GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" }))).toEqual(["gemini", "anthropic"]);
    expect(nombres(proveedorDesdeEntorno({ LLM_PROVIDER: "doble", GROQ_API_KEY: "q", ANTHROPIC_API_KEY: "a" }))).toEqual(["groq", "anthropic"]);
    expect(nombres(proveedorDesdeEntorno({ LLM_PROVIDER: "doble", GEMINI_API_KEY: "g", GROQ_API_KEY: "q" }))).toEqual(["gemini", "groq"]);
  });

  it("Groq respalda solo al primer lector: nunca puede leer dos veces el mismo documento", () => {
    const p = proveedorDesdeEntorno({ LLM_PROVIDER: "doble", GEMINI_API_KEY: "g", GROQ_API_KEY: "q", ANTHROPIC_API_KEY: "a" });
    expect(p.lectores?.[0]?.modelo).toMatch(/^gemini:.*>groq:/);
    expect(p.lectores?.[1]?.nombre).toBe("anthropic");
    expect(p.lectores?.[1]?.modelo).not.toContain("groq");
  });

  it("con un solo proveedor no hay doble lectura (cadena simple); sin llaves, ninguno", () => {
    expect(proveedorDesdeEntorno({ LLM_PROVIDER: "doble", GEMINI_API_KEY: "g" }).lectores).toBeUndefined();
    expect(proveedorDesdeEntorno({ LLM_PROVIDER: "doble" }).nombre).toBe("ninguno");
  });
});

describe("Claude Haiku (crearAnthropic)", () => {
  const doc: DocumentoNormalizado = {
    lineas_adjuntos: [],
    texto_mensaje: "Segue a fatura",
    visuales: [
      { nombre: "f.pdf", mime: "application/pdf", bytes: Buffer.from("%PDF-1.4") },
      { nombre: "f.png", mime: "image/png", bytes: Buffer.from("png") },
    ],
    adjunto_principal: "f.pdf",
    errores: [],
  } as unknown as DocumentoNormalizado;

  function cliente(respuesta: Partial<Anthropic.Message> | Error) {
    const pedidos: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const c = {
      messages: {
        create: async (p: Anthropic.MessageCreateParamsNonStreaming) => {
          pedidos.push(p);
          if (respuesta instanceof Error) throw respuesta;
          return { stop_reason: "end_turn", content: [], ...respuesta };
        },
      },
    } as unknown as Pick<Anthropic, "messages">;
    return { c, pedidos };
  }

  it("manda PDF e imagen como bloques, sin temperature (Haiku 5.5 la rechaza), esfuerzo bajo, y valida la respuesta", async () => {
    const { c, pedidos } = cliente({ content: [{ type: "text", text: JSON.stringify({ numero: conf("ES-4410") }), citations: null }] });
    const r = await crearAnthropic({ apiKey: "x", cliente: c }).extraer(doc, ["numero"]);
    expect(r.numero).toEqual({ valor: "ES-4410", confianza: 0.95, fuente: "llm" });
    expect(r.proveedor_llm).toBe("anthropic");
    const p = pedidos[0]!;
    expect(p.model).toBe("claude-haiku-5-5");
    expect(p).not.toHaveProperty("temperature");
    expect(p.output_config).toEqual({ effort: "low" });
    const bloques = (p.messages[0]!.content as Anthropic.ContentBlockParam[]).map((b) => b.type);
    expect(bloques).toEqual(["document", "image", "text"]);
  });

  it("rechazo o respuesta cortada → sin datos; error de la API → ErrorLLM (la cadena pasa al siguiente)", async () => {
    expect(await crearAnthropic({ apiKey: "x", cliente: cliente({ stop_reason: "refusal" }).c }).extraer(doc, ["numero"])).toEqual({ proveedor_llm: "anthropic" });
    expect(await crearAnthropic({ apiKey: "x", cliente: cliente({ stop_reason: "max_tokens" }).c }).extraer(doc, ["numero"])).toEqual({ proveedor_llm: "anthropic" });
    await expect(crearAnthropic({ apiKey: "x", cliente: cliente(new Error("red caída")).c }).extraer(doc, ["numero"])).rejects.toBeInstanceOf(ErrorLLM);
  });
});
