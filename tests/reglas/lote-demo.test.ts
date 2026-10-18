// Especificación §11.4: el lote demo reproduce exactamente el prototipo.

import { beforeAll, describe, expect, it } from "vitest";

import { formatearUsd } from "@/dominio/dinero";
import { procesarLote, type ResultadoLote } from "@/reglas/motor";

import { cargarGolden, type EscenarioGolden } from "./escenario";

let g: EscenarioGolden;
let lote: ResultadoLote;

beforeAll(async () => {
  g = await cargarGolden("lote-demo-oct");
  lote = procesarLote(
    g.docs.map(({ doc, ext }) => ({ doc, ext })),
    { datos: g.datos, reglas: g.reglas, historial: g.escenario.historial, ahora: g.escenario.config.ahora },
  );
});

describe("lote-demo-oct (§11.4)", () => {
  it("cada documento coincide con esperado.json", () => {
    expect(lote.resultados).toHaveLength(12);
    lote.resultados.forEach((r, i) => {
      const esp = g.docs[i]!.esperado;
      expect({ doc: esp.documento, decision: r.decision, reglas: r.reglas_que_fallaron, asignado: r.asignado_a, plazo: r.responder_antes_de })
        .toEqual({ doc: esp.documento, decision: esp.decision, reglas: esp.reglas_que_fallan, asignado: esp.asignado_a, plazo: esp.responder_antes_de });
    });
  });

  it("5 pagadas · 5 frenadas · 2 escaladas (R3 frena: TD-001 y OMI-3381)", () => {
    const conteo = lote.resultados.reduce<Record<string, number>>((c, r) => ({ ...c, [r.decision]: (c[r.decision] ?? 0) + 1 }), {});
    expect(conteo).toEqual({ PAGAR: 5, FRENAR: 5, ESCALAR: 2 });
  });

  it("disponible antes de cada documento", () => {
    expect(lote.resultados.map((r) => formatearUsd(r.disponible_antes_usd_centavos))).toEqual([
      "19.000,00", "17.000,00", "15.760,00", "13.705,95", "12.805,95", "11.555,95",
      "11.555,95", "11.555,95", "7.055,95", "7.055,95", "6.407,30", "6.407,30",
    ]);
  });

  it("cierre: pagado 7.444,05 · reservado 5.148,65 · disponible 6.407,30", () => {
    const p = lote.presupuestoFinal;
    expect(formatearUsd(p.pagado_antes)).toBe("41.000,00");
    expect(formatearUsd(p.pagado_en_lote)).toBe("7.444,05");
    expect(formatearUsd(p.reservado)).toBe("5.148,65");
    expect(formatearUsd(p.disponible)).toBe("6.407,30");
  });

  it("frenadas suman USD 14.515,45", () => {
    const frenado = lote.resultados.filter((r) => r.decision === "FRENAR").reduce((s, r) => s + (r.monto_usd_centavos ?? 0), 0);
    expect(formatearUsd(frenado)).toBe("14.515,45");
  });

  it("entradas REG-2026-000001…012 en orden, con ref interna y evaluaciones R1–R11", () => {
    expect(lote.entradas.map((e) => e.id)).toEqual(Array.from({ length: 12 }, (_, i) => `REG-2026-${String(i + 1).padStart(6, "0")}`));
    expect(lote.entradas.map((e) => e.ref_interna)).toEqual(g.docs.map((d) => d.esperado.ref_esperada));
    for (const e of lote.entradas) {
      expect(e.evaluaciones.map((x) => x.id)).toEqual(["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11"]);
      expect(e.tipo).toBe("DECISION_AGENTE");
    }
  });

  it("el duplicado INV-2210 apunta al pago de las 09:14:10", () => {
    const r2 = lote.resultados[5]!.evaluaciones.find((e) => e.id === "R2")!;
    expect(r2.comparacion).toBe("mismo emisor + número INV-2210 (pagada 09:14:10, REG-2026-000002)");
  });

  it("OMI-3381 lleva la observación de cercanía al límite automático", () => {
    expect(lote.resultados[10]!.observaciones).toEqual(["El monto está a USD 20,00 del límite automático."]);
  });

  it("es determinista: dos corridas dan lo mismo", () => {
    const otra = procesarLote(
      g.docs.map(({ doc, ext }) => ({ doc, ext })),
      { datos: g.datos, reglas: g.reglas, historial: g.escenario.historial, ahora: g.escenario.config.ahora },
    );
    expect(otra).toEqual(lote);
  });
});

describe("documento recibido en el periodo anterior", () => {
  it("se registra con `ahora` para que cuente en el presupuesto del lote", () => {
    const [primero] = g.docs;
    const viejo = { ...primero!, doc: { ...primero!.doc, recibido_en: "2026-09-30T23:50:00-05:00" } };
    const l = procesarLote([viejo], { datos: g.datos, reglas: g.reglas, historial: [], ahora: g.escenario.config.ahora });
    expect(l.entradas[0]!.momento).toBe(g.escenario.config.ahora);
    expect(l.presupuestoFinal.pagado_en_lote).toBe(200000);
  });
});
