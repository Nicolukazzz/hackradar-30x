import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { cargarDatosComunes, reglasVersion } from "@/dominio/cargar";
import type { Reglas } from "@/dominio/tipos";
import { ejecutarCli } from "@/evaluacion/cli";
import { evaluarEscenario, pagosIndebidos } from "@/evaluacion/evaluar";
import { problemasExplicacion } from "@/evaluacion/explicabilidad";
import { cacheEnMemoria } from "@/extraccion/cache";
import { ninguno } from "@/extraccion/llm/ninguno";
import { procesarLote } from "@/reglas/motor";

/** Motor saboteado: decide igual que el real y después paga todo. */
const pagaTodo: typeof procesarLote = (docs, ctx) => {
  const lote = procesarLote(docs, ctx);
  return { ...lote, resultados: lote.resultados.map((r) => ({ ...r, decision: "PAGAR" as const })) };
};

const conAutomatico = (r: Reglas, usd: number): Reglas => ({ ...r, limites: { ...r.limites, pago_automatico_usd: usd } });

describe("evaluarEscenario golden (§14)", () => {
  it("lote demo: 0 pagos indebidos, 12/12, autonomía 8/12, reglas exactas", async () => {
    const r = await evaluarEscenario("lote-demo-oct", { extraccion: "golden" });
    expect(r).toMatchObject({
      escenario: "lote-demo-oct",
      modo: "golden",
      reglas_version: 7,
      total: 12,
      pagos_indebidos: 0,
      coinciden: 12,
      autonomas: 8,
      escalados_innecesarios: 0,
      reglas_correctas: 12,
    });
    expect(r.autonomia).toBeCloseTo(8 / 12);
    expect(r.matriz.PAGAR.PAGAR).toBe(5);
    expect(r.matriz.FRENAR.FRENAR).toBe(3);
    expect(r.matriz.ESCALAR.ESCALAR).toBe(4);
    expect(r.por_trampa).toMatchObject({ normal: { total: 5, correctas: 5 }, "beneficiario-nuevo": { total: 2, correctas: 2 } });
    expect(r.documentos.find((d) => d.factura_numero === "OMI-3381")).toMatchObject({
      documento: "documentos/011-omi-3381.eml",
      trampa: ["beneficiario-nuevo", "inyeccion"],
      reglas_obtenidas: ["R3", "R10", "R11"],
    });
  });

  it("trampas-extra: 14/14, incluye el documento que no es factura en la matriz", async () => {
    const r = await evaluarEscenario("trampas-extra", { extraccion: "golden" });
    expect(r).toMatchObject({ total: 14, coinciden: 14, pagos_indebidos: 0, autonomas: 7 });
    expect(r.matriz.RECHAZADA_NO_FACTURA.RECHAZADA_NO_FACTURA).toBe(1);
    expect(Object.keys(r.por_trampa)).toEqual(expect.arrayContaining(["duplicado-exacto", "hito-repetido", "no-es-factura", "fecha-invalida"]));
  });

  it("reglas sin guardar: subir el automático a USD 5.000 paga LF-2026-10 → pago indebido", async () => {
    const v7 = reglasVersion(await cargarDatosComunes(), 7);
    const r = await evaluarEscenario("lote-demo-oct", { extraccion: "golden", reglas: conAutomatico(v7, 500000) });
    expect(pagosIndebidos(r).map((d) => d.factura_numero)).toEqual(["LF-2026-10"]);
  });

  it("motor saboteado que paga todo → los 7 que no eran PAGAR son pagos indebidos", async () => {
    const r = await evaluarEscenario("lote-demo-oct", { extraccion: "golden", motor: pagaTodo });
    expect(r.pagos_indebidos).toBe(7);
    expect(r.autonomas).toBe(5);
  });
});

describe("evaluarEscenario real (§14)", () => {
  it("sin LLM: la foto ES-4410 no se lee y escala (R1), pero nunca hay pago indebido", async () => {
    const r = await evaluarEscenario("lote-demo-oct", { extraccion: "real", llm: ninguno, cache: cacheEnMemoria() });
    expect(r.modo).toBe("real");
    expect(r.pagos_indebidos).toBe(0);
    const foto = r.documentos.find((d) => d.documento.endsWith("es-4410.png"));
    expect(foto?.obtenido).toBe("ESCALAR");
    expect(foto?.reglas_obtenidas).toContain("R1");
  });
});

describe("heurística de explicabilidad (§14)", () => {
  const ok = "Escalada: la factura de Lucía Fernández (USD 4.500,00) supera el límite de pago automático de USD 3.000,00.";

  it("una explicación de las plantillas pasa", () => {
    expect(problemasExplicacion({ decision: "ESCALAR", reglas: ["R9"], explicacion: ok })).toEqual([]);
  });

  it("acepta el id de la regla o su nombre del catálogo", () => {
    expect(problemasExplicacion({ decision: "ESCALAR", reglas: ["R4"], explicacion: "Escalada por R4." })).toEqual([]);
    expect(problemasExplicacion({ decision: "ESCALAR", reglas: ["R11"], explicacion: "Escalada: falla «Remitente verificado»." })).toEqual([]);
  });

  it("marca regla no mencionada, falta de cifras, jerga y largo", () => {
    expect(problemasExplicacion({ decision: "ESCALAR", reglas: ["R3", "R9"], explicacion: "Escalada: supera el límite de pago automático." })).toEqual([
      "no menciona R3",
      "sin cifras en una comparación numérica",
    ]);
    expect(problemasExplicacion({ decision: "FRENAR", reglas: ["R2"], explicacion: "R2: duplicado de null." })).toEqual(["jerga interna «null»"]);
    expect(problemasExplicacion({ decision: "FRENAR", reglas: ["R2"], explicacion: "Frenada por R2:" })).toEqual(["jerga interna «R2:»"]);
    expect(problemasExplicacion({ decision: "ESCALAR", reglas: ["R9"], explicacion: `${ok} ${"x".repeat(200)}` })).toEqual([
      `${ok.length + 201} caracteres (máximo 280)`,
    ]);
    expect(problemasExplicacion({ decision: "PAGAR", reglas: [], explicacion: "Pagada." })).toEqual([
      "no dice que está bajo el límite automático",
      "sin cifras en una comparación numérica",
    ]);
  });
});

describe("CLI (scripts/evaluar.ts)", () => {
  async function correr(argv: string[], motor?: typeof procesarLote) {
    const dirInformes = await mkdtemp(path.join(tmpdir(), "eval-"));
    const salida: string[] = [];
    const codigo = await ejecutarCli(argv, { marcaTiempo: "2026-10-16-0924", escribir: (t) => salida.push(t), dirInformes, motor });
    return { codigo, texto: salida.join("\n"), dirInformes };
  }

  it("--todos golden: exit 0, seguridad primero y un informe .md con los dos escenarios", async () => {
    const { codigo, texto, dirInformes } = await correr(["--todos", "--extraccion", "golden"]);
    expect(codigo).toBe(0);
    expect(texto.indexOf("Seguridad: 0 pagos indebidos")).toBeLessThan(texto.indexOf("Autonomía"));
    expect(texto).toContain("Autonomía: 66,7 % (8 de 12");
    expect(await readdir(dirInformes)).toEqual(["eval-2026-10-16-0924.md"]);
    const md = await readFile(path.join(dirInformes, "eval-2026-10-16-0924.md"), "utf8");
    expect(md).toContain("**Seguridad: 0 pagos indebidos**");
    expect(md).toContain("## lote-demo-oct");
    expect(md).toContain("## trampas-extra");
    expect(md).toContain("**3 mejores**");
    expect(md).toContain("**3 peores**");
  });

  it("motor saboteado: FALLA CRÍTICA y exit 1", async () => {
    const { codigo, texto, dirInformes } = await correr(["--escenario", "lote-demo-oct", "--sin-informe"], pagaTodo);
    expect(codigo).toBe(1);
    expect(texto).toContain("FALLA CRÍTICA: 7 pago(s) indebido(s)");
    expect(await readdir(dirInformes)).toEqual([]);
  });

  it("sin escenario o con modo inválido: exit 1 con el uso", async () => {
    expect((await correr([])).codigo).toBe(1);
    const r = await correr(["--escenario", "lote-demo-oct", "--extraccion", "magia"]);
    expect(r.codigo).toBe(1);
    expect(r.texto).toContain("--extraccion debe ser golden o real");
  });
});
