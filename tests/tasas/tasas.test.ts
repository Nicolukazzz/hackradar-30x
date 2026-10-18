// #86: tasas del día (foto diaria con respaldo) y moneda base distinta de USD.

import { beforeAll, describe, expect, it } from "vitest";

import { cargarEscenario, type DatosComunes, reglasVersion } from "@/dominio/cargar";
import { aBase, formatearBase, formatearTasa } from "@/dominio/dinero";
import type { Reglas, TablaTasas } from "@/dominio/tipos";
import { evaluarFactura } from "@/reglas/motor";
import { estadoInicial } from "@/reglas/presupuesto";
import { crearFuenteErApi } from "@/tasas/fuente-er-api";
import { almacenTasasMemoria, tasasVigentes } from "@/tasas/servicio";
import type { FuenteTasas } from "@/tasas/tipos";

import { AHORA, campo, ctx, datosComunes } from "../reglas/fixtures";

const fuenteFija = (tasas: Record<string, string>): FuenteTasas => ({ nombre: "fija", obtener: async (base) => ({ base, tasas, fuente: "fija" }) });
const fuenteCaida: FuenteTasas = { nombre: "caída", obtener: async () => Promise.reject(new Error("HTTP 503")) };

describe("tasas del día (#86)", () => {
  it("sin foto de hoy: la toma de la fuente, la guarda y la usa; la segunda vez no llama a la red", async () => {
    const almacen = almacenTasasMemoria();
    let llamadas = 0;
    const fuente: FuenteTasas = { nombre: "x", obtener: async (base) => (llamadas++, { base, tasas: { COP: "3182.78" }, fuente: "x" }) };
    const r = await tasasVigentes("USD", "2026-10-17", { almacen, fuente });
    expect(r).toMatchObject({ estado: "hoy", fecha: "2026-10-17", tabla: { periodo: "2026-10", base: "USD", tasas: { COP: "3182.78" } } });
    await tasasVigentes("USD", "2026-10-17", { almacen, fuente });
    expect(llamadas).toBe(1);
  });

  it("la fuente falla: usa la última foto; sin ninguna, tabla vacía (solo la base se convierte)", async () => {
    const almacen = almacenTasasMemoria([{ fecha: "2026-10-15", base: "USD", tasas: { MXN: "18.40" }, fuente: "fija" }]);
    const errores: unknown[] = [];
    expect(await tasasVigentes("USD", "2026-10-17", { almacen, fuente: fuenteCaida, alFallar: (e) => errores.push(e) })).toMatchObject({
      estado: "anterior",
      fecha: "2026-10-15",
      tabla: { tasas: { MXN: "18.40" } },
    });
    expect(errores).toHaveLength(1);
    expect(await tasasVigentes("COP", "2026-10-17", { almacen: almacenTasasMemoria(), fuente: fuenteCaida })).toMatchObject({ estado: "ninguna", tabla: { base: "COP", tasas: {} } });
    expect(await tasasVigentes("USD", "2026-10-17", { almacen, fuente: fuenteFija({ MXN: "18.50" }) })).toMatchObject({ estado: "hoy", tabla: { tasas: { MXN: "18.50" } } });
  });

  it("open.er-api.com: decimales en texto, USDC 1:1 con el dólar y sin la propia base", async () => {
    const f = (async () => new Response(JSON.stringify({ result: "success", rates: { USD: 1, COP: 3182.776456, MXN: 18.4668, EUR: 0.889517, XYZ: 2 } }))) as unknown as typeof fetch;
    const r = await crearFuenteErApi(f).obtener("USD");
    expect(r.tasas).toEqual({ COP: "3182.776456", MXN: "18.4668", EUR: "0.889517", USDC: "1" });
    // Base COP: la tasa del dólar es chica; con cifras significativas no se pierde precisión.
    const r2 = await crearFuenteErApi((async () => new Response(JSON.stringify({ result: "success", rates: { USD: 0.000314186390123 } }))) as unknown as typeof fetch).obtener("COP");
    expect(r2.tasas.USD).toBe("0.000314186390123");
    const caida = (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
    await expect(crearFuenteErApi(caida).obtener("USD")).rejects.toThrow("HTTP 500");
  });
});

describe("moneda base distinta de USD (#86)", () => {
  const cop: TablaTasas = { periodo: "2026-10", base: "COP", tasas: { USD: "0.000238095238", MXN: "0.0044" } };

  it("aBase convierte a la moneda base; la tasa no se guarda si ya es la base; COP con centavos se muestra con decimales", () => {
    expect(aBase({ centavos: 840000000, moneda: "COP" }, cop)).toEqual({ base_centavos: 840000000, tasa_usada: null });
    expect(aBase({ centavos: 200000, moneda: "USD" }, cop).base_centavos).toBe(840000000);
    expect(formatearTasa("COP", cop)).toBeNull();
    expect(formatearTasa("USD", cop)).toBe("USD 0,0002381");
    expect(formatearBase(840000050, "COP")).toBe("COP 8.400.000,50");
    expect(formatearBase(840000000, "COP")).toBe("COP 8.400.000");
  });

  let d: DatosComunes;
  beforeAll(async () => {
    d = await datosComunes();
  });

  it("reglas en USD con tasas en COP: no decide sola (escala y lo explica)", async () => {
    const reglas: Reglas = reglasVersion(d, 7);
    const c = ctx(d);
    const historial = (await cargarEscenario("lote-demo-oct")).historial;
    const r = evaluarFactura({
      doc: c.doc,
      ext: c.ext,
      datos: { ...d, tasas: { "2026-10": cop } },
      reglas,
      historial,
      presupuesto: estadoInicial(historial, reglas, "2026-10"),
      ahora: AHORA,
    });
    expect(r.decision).toBe("ESCALAR");
    expect(r.explicacion).toContain("los límites de las reglas están en USD y las tasas del día en COP");
  });

  it("reglas y tasas en COP: los textos de R9 dicen COP", () => {
    const v7 = reglasVersion(d, 7);
    const reglas: Reglas = { ...v7, moneda: "COP", limites: { ...v7.limites, pago_automatico_usd: 1_260_000_000 } };
    const c = ctx(d, { reglas, tasas: cop, ext: { monto_total: campo({ centavos: 840000000, moneda: "COP" }) } });
    const r = evaluarFactura({ doc: c.doc, ext: c.ext, datos: { ...d, tasas: { "2026-10": cop } }, reglas, historial: [], presupuesto: { ...c.presupuesto, disponible: 10_000_000_000 }, ahora: AHORA });
    expect(r.evaluaciones.find((e) => e.id === "R9")?.comparacion).toBe("8.400.000,00 ≤ 12.600.000,00 COP");
  });
});
