// Especificación §11.6: cada trampa de noviembre cae por una sola causa.

import { beforeAll, describe, expect, it } from "vitest";

import { procesarLote, type ResultadoLote } from "@/reglas/motor";

import { cargarGolden, type EscenarioGolden } from "./escenario";

let g: EscenarioGolden;
let lote: ResultadoLote;

beforeAll(async () => {
  g = await cargarGolden("trampas-extra");
  lote = procesarLote(
    g.docs.map(({ doc, ext }) => ({ doc, ext })),
    { datos: g.datos, reglas: g.reglas, historial: g.escenario.historial, ahora: g.escenario.config.ahora },
  );
});

describe("trampas-extra (§11.6)", () => {
  it("cada documento coincide con esperado.json", () => {
    expect(lote.resultados).toHaveLength(14);
    lote.resultados.forEach((r, i) => {
      const esp = g.docs[i]!.esperado;
      expect({ doc: esp.documento, decision: r.decision, reglas: r.reglas_que_fallaron, asignado: r.asignado_a, plazo: r.responder_antes_de })
        .toEqual({ doc: esp.documento, decision: esp.decision, reglas: esp.reglas_que_fallan, asignado: esp.asignado_a, plazo: esp.responder_antes_de });
    });
  });

  it("PAGAR 3 · FRENAR 3 · ESCALAR 7 · RECHAZADA_NO_FACTURA 1", () => {
    const conteo = lote.resultados.reduce<Record<string, number>>((c, r) => ({ ...c, [r.decision]: (c[r.decision] ?? 0) + 1 }), {});
    expect(conteo).toEqual({ PAGAR: 3, FRENAR: 3, ESCALAR: 7, RECHAZADA_NO_FACTURA: 1 });
  });

  it("los ids siguen después del historial (lote demo + resoluciones humanas)", () => {
    const previos = g.escenario.historial.filter((e) => /^REG-2026-\d{6}$/.test(e.id)).length;
    expect(lote.entradas[0]!.id).toBe(`REG-2026-${String(previos + 1).padStart(6, "0")}`);
  });

  it("noviembre empieza sin pagos previos", () => {
    expect(lote.resultados[0]!.disponible_antes_usd_centavos).toBe(g.reglas.presupuesto.monto_usd);
  });
});
