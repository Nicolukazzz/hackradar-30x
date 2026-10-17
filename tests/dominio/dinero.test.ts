import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";

import { cargarDatosComunes, cargarEscenario, type DatosComunes, tasasDelPeriodo } from "@/dominio/cargar";
import {
  aCentavos,
  aUsd,
  diferenciaPct,
  formatear,
  formatearNumero,
  formatearTasa,
  formatearUsd,
  porcentaje,
  tasaDe,
} from "@/dominio/dinero";
import type { Moneda, TablaTasas } from "@/dominio/tipos";

const OCT: TablaTasas = {
  periodo: "2026-10",
  base: "USD",
  tasas: { USD: "1", COP: "4200.00", MXN: "18.50", BRL: "5.50", ARS: "1150.00" },
};

describe("conversión a USD (§6, valores del lote demo)", () => {
  it.each<[number, Moneda, number, string | null]>([
    [840000000, "COP", 200000, "COP 4.200,00"],
    [3800000, "MXN", 205405, "MXN 18,50"],
    [1200000, "MXN", 64865, "MXN 18,50"],
    [2200000, "BRL", 400000, "BRL 5,50"],
    [124000, "USD", 124000, null],
  ])("%i %s → %i centavos USD", (centavos, moneda, usd, tasa) => {
    expect(aUsd({ centavos, moneda }, OCT)).toEqual({ usd_centavos: usd, tasa_usada: tasa });
  });

  it("redondea half-up al centavo", () => {
    expect(aUsd({ centavos: 1, moneda: "MXN" }, { ...OCT, tasas: { MXN: "2" } }).usd_centavos).toBe(1);
    expect(aUsd({ centavos: 3, moneda: "MXN" }, { ...OCT, tasas: { MXN: "2" } }).usd_centavos).toBe(2);
  });

  it("falla con un mensaje claro si el periodo no tiene la moneda", () => {
    expect(() => aUsd({ centavos: 100, moneda: "BOB" }, OCT)).toThrow("sin tasa para BOB en el periodo 2026-10");
  });

  it("USD nunca cambia de valor (propiedad)", () => {
    expect(() =>
      fc.assert(fc.property(fc.nat(), (c) => aUsd({ centavos: c, moneda: "USD" }, OCT).usd_centavos === c)),
    ).not.toThrow();
  });

  it("siempre devuelve centavos enteros (propiedad)", () => {
    expect(() =>
      fc.assert(
        fc.property(fc.nat({ max: 10 ** 12 }), fc.constantFrom<Moneda>("COP", "MXN", "BRL", "ARS"), (c, m) =>
          Number.isInteger(aUsd({ centavos: c, moneda: m }, OCT).usd_centavos),
        ),
      ),
    ).not.toThrow();
  });

  it("tasaDe(USD) es 1 aunque la tabla no lo traiga", () => {
    expect(tasaDe("USD", { ...OCT, tasas: {} }).toNumber()).toBe(1);
  });
});

describe("formatos es-CO", () => {
  it.each([
    [744405, "7.444,05"],
    [227730, "2.277,30"],
    [0, "0,00"],
    [5, "0,05"],
    [100000000, "1.000.000,00"],
  ])("formatearUsd(%i) = %s", (c, texto) => {
    expect(formatearUsd(c)).toBe(texto);
  });

  it("COP y CLP sin decimales; el resto con dos", () => {
    expect(formatear({ centavos: 840000000, moneda: "COP" })).toBe("COP 8.400.000");
    expect(formatear({ centavos: 3800000, moneda: "MXN" })).toBe("MXN 38.000,00");
    expect(formatear({ centavos: 744405, moneda: "USD" })).toBe("USD 7.444,05");
  });

  it("rechaza centavos negativos o con decimales", () => {
    expect(() => formatearNumero(-1)).toThrow(RangeError);
    expect(() => formatearNumero(1.5)).toThrow(RangeError);
  });

  it("aCentavos convierte texto decimal sin errores de float", () => {
    expect(aCentavos("1240.00")).toBe(124000);
    expect(aCentavos("8400000")).toBe(840000000);
    expect(aCentavos("0.1")).toBe(10);
    expect(aCentavos("2054.054")).toBe(205405);
  });

  it("porcentaje y diferencia contra lo acordado (R5 de PX-77)", () => {
    expect(porcentaje(diferenciaPct(260000, 180000))).toBe("+44,4%");
    expect(porcentaje(0)).toBe("0,0%");
    expect(porcentaje(-3.25)).toBe("-3,3%");
    expect(() => diferenciaPct(1, 0)).toThrow(RangeError);
  });

  it("una moneda sin decimales con centavos es un error (igual que dinero.py), no se redondea en silencio", () => {
    expect(() => formatear({ centavos: 441176550, moneda: "COP" })).toThrow("monto con centavos en moneda sin decimales");
  });

  it("formatearTasa redondea half-up como el generador (18.505 → 18,51)", () => {
    expect(formatearTasa("MXN", { ...OCT, tasas: { MXN: "18.505" } })).toBe("MXN 18,51");
  });

  it("formatearTasa agrupa miles", () => {
    expect(formatearTasa("COP", OCT)).toBe("COP 4.200,00");
    expect(formatearTasa("USD", OCT)).toBeNull();
  });
});

describe("paridad con el generador del dataset (Python, #3)", () => {
  let datos: DatosComunes;
  beforeAll(async () => {
    datos = await cargarDatosComunes();
  });

  it.each(["lote-demo-oct", "trampas-extra"])(
    "%s: cada entrada del historial tiene los mismos USD y la misma tasa que calcula TypeScript",
    async (id) => {
      const { historial } = await cargarEscenario(id);
      const conMonto = historial.filter((e) => e.monto_original !== null);
      expect(conMonto.length).toBeGreaterThan(10);
      for (const e of conMonto) {
        const tabla = tasasDelPeriodo(datos, e.momento.slice(0, 7));
        expect(aUsd(e.monto_original!, tabla), `${e.id} ${e.factura_numero}`).toEqual({
          usd_centavos: e.monto_usd_centavos,
          tasa_usada: e.tasa_usada,
        });
      }
    },
  );
});
