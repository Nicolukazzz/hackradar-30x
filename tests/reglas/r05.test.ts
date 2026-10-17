import { beforeAll, describe, expect, it } from "vitest";

import type { DatosComunes } from "@/dominio/cargar";
import { reglasVersion } from "@/dominio/cargar";
import { r05Acordado } from "@/reglas/r05-acordado";

import { campo, ctx, datosComunes, delLote } from "./fixtures";

let d: DatosComunes;
beforeAll(async () => {
  d = await datosComunes();
});

const diego = (concepto: string, centavos: number, ref?: string) => ({
  beneficiario_nombre: campo("Diego Herrera"),
  concepto: campo(concepto),
  monto_total: campo({ centavos, moneda: "MXN" as const }),
  referencia_acuerdo: ref ? campo(ref) : undefined,
});

describe("R5 Cuadra con lo acordado", () => {
  it("CUMPLE por referencia del acuerdo", () => {
    expect(r05Acordado(ctx(d)).comparacion).toBe("coincide 0,0% (AMG-DIS acordó COP 8.400.000)");
  });
  it("CUMPLE dentro de la tolerancia y elige línea por palabras clave", () => {
    const e = r05Acordado(ctx(d, { ext: diego("Soporte on-call — octubre", 1220000) }));
    expect(e.comparacion).toBe("+1,7% ≤ 2% (DH-ONCALL acordó MXN 12.000,00)");
  });
  it("FALLA fuera de la tolerancia", () => {
    const e = r05Acordado(ctx(d, { ext: diego("Desarrollo backend", 4000000, "DH-DEV") }));
    expect([e.resultado, e.comparacion]).toEqual(["FALLA", "+5,3% > 2% (DH-DEV acordó MXN 38.000,00)"]);
  });
  it("INDETERMINADO si no se puede elegir línea o la moneda no coincide", () => {
    expect(r05Acordado(ctx(d, { ext: diego("Servicios varios", 1200000) })).comparacion).toBe("ninguna línea de CT-DH coincide con el concepto");
    expect(r05Acordado(ctx(d, { ext: diego("desarrollo backend y soporte on-call", 1200000) })).comparacion).toBe("2 líneas de CT-DH coinciden con el concepto");
    const e = r05Acordado(ctx(d, { ext: { monto_total: campo({ centavos: 200000, moneda: "USD" }) } }));
    expect([e.resultado, e.comparacion]).toEqual(["INDETERMINADO", "la factura está en USD y AMG-DIS está en COP"]);
  });
  it("NO_APLICA si está desactivada, si R3 falla o si el monto no es confiable", () => {
    const v = reglasVersion(d, 7);
    expect(r05Acordado(ctx(d, { reglas: { ...v, activas: { ...v.activas, R5: false } } })).comparacion).toBe("Regla desactivada en v7");
    expect(r05Acordado(ctx(d, { ext: { beneficiario_nombre: campo("Nova Prints") } })).resultado).toBe("NO_APLICA");
    expect(r05Acordado(ctx(d, { ext: { monto_total: campo<never>(null) } })).comparacion).toBe("sin dato confiable (ver R1)");
  });
  it("lote demo: PX-77 cobra +44,4 %; JPO-10 es el hito 2/3", async () => {
    expect((await delLote("PX-77", "R5")).comparacion).toBe("+44,4% > 2% (OC-121 acordó USD 1.800,00)");
    expect((await delLote("JPO-10", "R5")).comparacion).toBe("hito 2/3 · coincide 0,0% (JPO-HITO acordó USD 900,00)");
  });
});

describe("R5 referencia con otra grafía", () => {
  it("«oc 121» encuentra la línea OC-121", async () => {
    const d = await datosComunes();
    const e = r05Acordado(ctx(d, { ext: {
      beneficiario_nombre: campo("Pixel & Co."), concepto: campo("Servicios"), referencia_acuerdo: campo("oc 121"),
      monto_total: campo({ centavos: 180000, moneda: "USD" }),
    } }));
    expect(e.comparacion).toBe("coincide 0,0% (OC-121 acordó USD 1.800,00)");
  });
});
