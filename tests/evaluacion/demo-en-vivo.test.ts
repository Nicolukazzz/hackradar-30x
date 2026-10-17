// demo-en-vivo (#65): las facturas que se mandan en vivo, con el motor real de TypeScript (no solo el oráculo Python).

import { describe, expect, it } from "vitest";

import { evaluarEscenario } from "@/evaluacion/evaluar";

describe("escenario demo-en-vivo", () => {
  it("el motor decide igual que el esperado, sin pagos indebidos", async () => {
    const r = await evaluarEscenario("demo-en-vivo", { extraccion: "golden" });
    expect(r).toMatchObject({ total: 4, coinciden: 4, pagos_indebidos: 0, reglas_correctas: 4 });
    const por = Object.fromEntries(r.documentos.map((d) => [d.factura_numero, d]));
    // F-0106: mismo cobro mensual que F-0093 con otro número → R2 frena.
    expect(por["F-0106"]).toMatchObject({ obtenido: "FRENAR", reglas_obtenidas: ["R2"] });
    // INV-2216: compra única de la OC-122, aparte del hosting mensual (OC-118) ya pagado en octubre → se paga sola.
    expect(por["INV-2216"]).toMatchObject({ obtenido: "PAGAR", reglas_obtenidas: [] });
    // ML-560: la orden en texto blanco viene SOLO en el PDF; el modo golden la lee del adjunto real → R10 escala.
    expect(por["ML-560"]).toMatchObject({ obtenido: "ESCALAR", reglas_obtenidas: ["R10"] });
    expect(por["LUM-0007"]).toMatchObject({ obtenido: "ESCALAR" });
  });
});
