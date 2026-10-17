import { beforeAll, describe, expect, it } from "vitest";

import type { DatosComunes } from "@/dominio/cargar";
import { r01Extraccion } from "@/reglas/r01-extraccion";

import { campo, ctx, datosComunes } from "./fixtures";

let d: DatosComunes;
beforeAll(async () => {
  d = await datosComunes();
});

describe("R1 Extracción completa y confiable", () => {
  it("CUMPLE con todos los campos y confianza alta", () => {
    const e = r01Extraccion(ctx(d, { ext: { monto_total: campo({ centavos: 840000000, moneda: "COP" }, 0.94) } }));
    expect(e.resultado).toBe("CUMPLE");
    expect(e.comparacion).toBe("confianza mínima 94% ≥ 90%");
  });

  it("FALLA si falta un obligatorio", () => {
    const e = r01Extraccion(ctx(d, { ext: { cuenta_destino_ultimos4: campo<never>(null) } }));
    expect(e.resultado).toBe("FALLA");
    expect(e.comparacion).toBe("falta cuenta destino");
    expect(e.datos.campos_afectados).toBe("cuenta_destino_ultimos4");
  });

  it("FALLA con baja confianza", () => {
    const e = r01Extraccion(ctx(d, { ext: { monto_total: campo({ centavos: 840000000, moneda: "COP" }, 0.72) } }));
    expect(e.comparacion).toBe("confianza de monto total 72% < 90%");
  });

  it("FALLA si subtotal + impuestos ≠ total (ML-571)", () => {
    const e = r01Extraccion(
      ctx(d, {
        ext: {
          beneficiario_nombre: campo("Mesa Legal S.A.S."),
          subtotal: campo({ centavos: 441176500, moneda: "COP" }),
          impuestos: campo({ centavos: 83823500, moneda: "COP" }),
          monto_total: campo({ centavos: 535000000, moneda: "COP" }),
        },
      }),
    );
    expect(e.comparacion).toBe("subtotal 4.411.765 + impuestos 838.235 ≠ total 5.350.000 COP");
  });

  it("FALLA con fecha de emisión futura, vencimiento antes de emisión, monto 0 o moneda sin tasa", () => {
    expect(r01Extraccion(ctx(d, { ext: { fecha_emision: campo("2026-12-02"), fecha_vencimiento: campo("2026-12-17") } })).comparacion)
      .toBe("fecha de emisión 02/12/2026 posterior a hoy 16/10/2026");
    expect(r01Extraccion(ctx(d, { ext: { fecha_vencimiento: campo("2026-10-01") } })).comparacion)
      .toBe("vence 01/10/2026 antes de emitirse 10/10/2026");
    expect(r01Extraccion(ctx(d, { ext: { monto_total: campo({ centavos: 0, moneda: "USD" }) } })).comparacion)
      .toBe("el monto total no es mayor que 0");
    expect(r01Extraccion(ctx(d, { ext: { monto_total: campo({ centavos: 100000, moneda: "ZAR" }) } })).comparacion)
      .toBe("no hay tasa para ZAR en 2026-10");
    expect(r01Extraccion(ctx(d, { ext: { fecha_emision: campo("2026-02-30") } })).comparacion)
      .toBe("fecha de emisión inválida (2026-02-30)");
  });

  it("FALLA si no se puede confirmar que sea factura", () => {
    expect(r01Extraccion(ctx(d, { ext: { es_factura: campo(true, 0.5) } })).comparacion)
      .toBe("no se pudo confirmar que sea factura (confianza 50% < 90%)");
  });

  it("varias causas se unen con ·", () => {
    const e = r01Extraccion(ctx(d, { ext: { numero: campo<never>(null), concepto: campo("x", 0.3) } }));
    expect(e.comparacion).toBe("falta número de factura · confianza de concepto 30% < 90%");
  });
});
