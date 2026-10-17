import { describe, expect, it } from "vitest";

import { aDinero, buscarMonto, numeroADecimal, parsearFecha } from "@/extraccion/parsers/valores";

describe("montos es-CO / en-US / pt-BR", () => {
  it.each([
    ["1,240.00", "1240.00"],
    ["2.980,00", "2980.00"],
    ["8.400.000", "8400000"],
    ["38000.00", "38000.00"],
    ["12,000.5", "12000.5"],
    ["1.234.567,89", "1234567.89"],
  ])("%s → %s", (entrada, salida) => expect(numeroADecimal(entrada)).toBe(salida));

  it("monto con moneda", () => {
    expect(buscarMonto("Total | COP 5.250.000")).toEqual({ centavos: 525000000, moneda: "COP" });
    expect(buscarMonto("Valor: MXN 12,000.00")).toEqual({ centavos: 1200000, moneda: "MXN" });
    expect(buscarMonto("Total: BRL 22.000,00")).toEqual({ centavos: 2200000, moneda: "BRL" });
    expect(buscarMonto("sin monto")).toBeNull();
  });

  it("rechaza moneda desconocida, cero y basura", () => {
    expect(aDinero("XYZ", "10")).toBeNull();
    expect(aDinero("USD", "0,00")).toBeNull();
    expect(aDinero("USD", "1a2")).toBeNull();
  });
});

describe("fechas", () => {
  it.each([
    ["08/10/2026", "2026-10-08"],
    ["Oct 8, 2026", "2026-10-08"],
    ["Nov 15, 2026", "2026-11-15"],
    ["2026-12-02", "2026-12-02"],
  ])("%s → %s", (entrada, salida) => expect(parsearFecha(entrada)).toBe(salida));

  it("rechaza fechas que no existen", () => {
    expect(parsearFecha("31/02/2026")).toBeNull();
    expect(parsearFecha("Foo 1, 2026")).toBeNull();
  });
});
