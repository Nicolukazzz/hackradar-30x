import { beforeAll, describe, expect, it } from "vitest";

import type { DatosComunes } from "@/dominio/cargar";
import { r06Maximo } from "@/reglas/r06-maximo";
import { r07Presupuesto } from "@/reglas/r07-presupuesto";
import { r09Automatico } from "@/reglas/r09-automatico";

import { campo, ctx, datosComunes, delLote } from "./fixtures";

let d: DatosComunes;
beforeAll(async () => {
  d = await datosComunes();
});

const usd = (centavos: number) => ({ ext: { monto_total: campo({ centavos, moneda: "USD" as const }) } });

describe("R6 Bajo el máximo absoluto", () => {
  it("CUMPLE / FALLA / NO_APLICA", () => {
    expect(r06Maximo(ctx(d, usd(298000))).comparacion).toBe("2.980,00 ≤ 15.000,00 USD");
    expect(r06Maximo(ctx(d, usd(1500000))).resultado).toBe("CUMPLE");
    const e = r06Maximo(ctx(d, usd(1800000)));
    expect([e.resultado, e.comparacion]).toEqual(["FALLA", "18.000,00 > 15.000,00 USD"]);
    expect(r06Maximo(ctx(d, { ext: { monto_total: campo<never>(null) } })).resultado).toBe("NO_APLICA");
  });
});

describe("R7 Presupuesto disponible", () => {
  it("CUMPLE / FALLA según el disponible al evaluar", () => {
    const base = ctx(d);
    const conDisponible = (disponible: number, centavos: number) => r07Presupuesto({ ...ctx(d, usd(centavos)), presupuesto: { ...base.presupuesto, disponible } });
    expect(conDisponible(400000, 400000).comparacion).toBe("4.000,00 ≤ 4.000,00 USD disponibles al evaluar");
    expect(conDisponible(227730, 400000).comparacion).toBe("4.000,00 > 2.277,30 USD disponibles al evaluar");
    expect(conDisponible(-5000, 100).comparacion).toBe("1,00 > -50,00 USD disponibles al evaluar");
    expect(r07Presupuesto(ctx(d, { ext: { monto_total: campo<never>(null) } })).resultado).toBe("NO_APLICA");
  });
  it("lote demo: ES-4410", async () => {
    expect((await delLote("ES-4410", "R7")).comparacion).toBe("6.545,45 > 6.407,30 USD disponibles al evaluar");
  });
});

describe("R9 Bajo el límite automático", () => {
  it("CUMPLE en el límite exacto, FALLA por un centavo", () => {
    expect(r09Automatico(ctx(d, usd(300000))).comparacion).toBe("3.000,00 ≤ 3.000,00 USD");
    expect(r09Automatico(ctx(d, usd(300001))).comparacion).toBe("3.000,01 > 3.000,00 USD");
    expect(r09Automatico(ctx(d, { ext: { monto_total: campo<never>(null) } })).resultado).toBe("NO_APLICA");
  });
  it("lote demo: LF-2026-10", async () => {
    expect((await delLote("LF-2026-10", "R9")).comparacion).toBe("4.500,00 > 3.000,00 USD");
  });
});
