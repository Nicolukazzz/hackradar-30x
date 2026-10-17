import { beforeAll, describe, expect, it } from "vitest";

import type { DatosComunes } from "@/dominio/cargar";
import { reglasVersion } from "@/dominio/cargar";
import { r08Mensual } from "@/reglas/r08-mensual";

import { campo, ctx, datosComunes, delLote, loteDemo } from "./fixtures";

let d: DatosComunes;
beforeAll(async () => {
  d = await datosComunes();
});

describe("R8 Límite mensual por beneficiario", () => {
  it("CUMPLE bajo el límite propio del beneficiario", () => {
    expect(r08Mensual(ctx(d)).comparacion).toBe("0,00 + 2.000,00 = 2.000,00 ≤ 6.000,00 USD");
  });
  it("FALLA sobre el límite", () => {
    const e = r08Mensual(ctx(d, { ext: { monto_total: campo({ centavos: 2600000000, moneda: "COP" }) } }));
    expect([e.resultado, e.comparacion]).toEqual(["FALLA", "0,00 + 6.190,48 = 6.190,48 > 6.000,00 USD"]);
  });
  it("NO_APLICA desactivada o fuera de lista", () => {
    const v = reglasVersion(d, 7);
    expect(r08Mensual(ctx(d, { reglas: { ...v, activas: { ...v.activas, R8: false } } })).comparacion).toBe("Regla desactivada en v7");
    expect(r08Mensual(ctx(d, { ext: { beneficiario_nombre: campo("Nova Prints") } })).resultado).toBe("NO_APLICA");
  });
  it("lote demo: F-0101 suma lo ya pagado a Diego en el mismo lote", async () => {
    expect((await delLote("F-0101", "R8")).comparacion).toBe("2.054,05 + 648,65 = 2.702,70 ≤ 6.000,00 USD");
  });
});

describe("R8 es mensual aunque el presupuesto sea quincenal", () => {
  it("suma lo pagado en la primera quincena del mes", async () => {
    const d = await datosComunes();
    const v7 = reglasVersion(d, 7);
    const quincenal = { ...v7, presupuesto: { ...v7.presupuesto, periodo: "quincenal" as const } };
    const previo = (await loteDemo()).lote.entradas[0]!; // FAC-1041, USD 2.000 pagados el 16-oct
    const temprano = { ...previo, momento: "2026-10-05T10:00:00-05:00" };
    const e = r08Mensual(ctx(d, { reglas: quincenal, historial: [temprano], ext: { monto_total: campo({ centavos: 2100000000, moneda: "COP" }) } }));
    expect(e.comparacion).toBe("2.000,00 + 5.000,00 = 7.000,00 > 6.000,00 USD");
  });
});
