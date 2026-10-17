import { beforeAll, describe, expect, it } from "vitest";

import type { DatosComunes } from "@/dominio/cargar";
import type { EntradaRegistro, Extraccion } from "@/dominio/tipos";
import { r02Duplicado } from "@/reglas/r02-duplicado";

import { campo, ctx, datosComunes, delLote, extBase } from "./fixtures";

let d: DatosComunes;
beforeAll(async () => {
  d = await datosComunes();
});

function previa(cambios: Partial<EntradaRegistro> & { ext?: Partial<Extraccion> } = {}): EntradaRegistro {
  const { ext, ...resto } = cambios;
  return {
    id: "REG-2026-000001",
    momento: "2026-10-16T09:00:00-05:00",
    actor: { tipo: "agente" },
    tipo: "DECISION_AGENTE",
    ref_interna: "INT-2026-000001",
    factura_numero: "FAC-1041",
    beneficiario: "Ana María Gómez",
    canal: "portal",
    formato: "pdf",
    monto_original: { centavos: 840000000, moneda: "COP" },
    monto_usd_centavos: 200000,
    tasa_usada: "COP 4.200,00",
    decision: "PAGAR",
    reglas_version: 7,
    evaluaciones: [],
    reglas_que_fallaron: [],
    comparaciones: [],
    explicacion: "",
    comentario: null,
    entrada_origen: null,
    extraccion: { ...extBase(), ...ext },
    sha256: "b".repeat(64),
    ...resto,
  };
}

describe("R2 No es duplicada", () => {
  it("CUMPLE sin facturas previas del emisor", () => {
    const e = r02Duplicado(ctx(d));
    expect(e.resultado).toBe("CUMPLE");
    expect(e.comparacion).toBe("sin facturas de este emisor en 45 días");
  });

  it("FALLA por mismo número (aunque el nombre venga con otra grafía)", () => {
    const e = r02Duplicado(ctx(d, { historial: [previa({ beneficiario: "ANA MARIA GOMEZ" })], ext: { numero: campo("fac 1041") } }));
    expect(e.resultado).toBe("FALLA");
    expect(e.comparacion).toBe("mismo emisor + número FAC-1041 (pagada 09:00:00, REG-2026-000001)");
  });

  it("FALLA por mismo archivo, sin ventana", () => {
    const h = previa({ factura_numero: "FAC-0900", momento: "2026-01-05T10:00:00-05:00", sha256: "a".repeat(64), ext: { fecha_emision: campo("2026-01-02") } });
    expect(r02Duplicado(ctx(d, { historial: [h] })).comparacion).toBe("mismo archivo (sha256) que FAC-0900 (pagada 05/01/2026 10:00:00, REG-2026-000001)");
  });

  it("FALLA por monto ±1 % y fecha ±7 días, aunque el número cambie", () => {
    const h = previa({ factura_numero: "FAC-1040", monto_usd_centavos: 201000, ext: { fecha_emision: campo("2026-10-05") } });
    expect(r02Duplicado(ctx(d, { historial: [h] })).comparacion).toBe("monto ±1% y fecha ±7 días de FAC-1040 (pagada 09:00:00, REG-2026-000001)");
  });

  it("FALLA contra una escalada pendiente; CUMPLE si fue rechazada", () => {
    const esc = previa({ decision: "ESCALAR" });
    expect(r02Duplicado(ctx(d, { historial: [esc] })).comparacion).toBe("mismo emisor + número FAC-1041 (escalada, pendiente 09:00:00, REG-2026-000001)");
    const rechazo = previa({ id: "REG-2026-000002", tipo: "DECISION_HUMANA", decision: "RECHAZADA_HUMANO", entrada_origen: "REG-2026-000001" });
    expect(r02Duplicado(ctx(d, { historial: [esc, rechazo] })).resultado).toBe("CUMPLE");
  });

  it("mismo número fuera de la ventana de 45 días no es duplicado", () => {
    const h = previa({ ext: { fecha_emision: campo("2026-08-01") }, monto_usd_centavos: 1 });
    expect(r02Duplicado(ctx(d, { historial: [h] })).resultado).toBe("CUMPLE");
  });

  it("hito ya pagado: FALLA sin ventana", () => {
    const h = previa({
      beneficiario: "Juan Pablo Ortiz", factura_numero: "JPO-10", monto_usd_centavos: 1,
      ext: { fecha_emision: campo("2026-01-14"), hito_numero: campo(2) },
    });
    const e = r02Duplicado(ctx(d, { historial: [h], ext: { beneficiario_nombre: campo("Juan Pablo Ortiz"), numero: campo("JPO-11"), hito_numero: campo(2) } }));
    expect(e.comparacion).toBe("hito 2 ya pagado con JPO-10 (pagada 09:00:00, REG-2026-000001)");
  });

  it("NO_APLICA sin beneficiario legible", () => {
    expect(r02Duplicado(ctx(d, { ext: { beneficiario_nombre: campo<never>(null) } })).resultado).toBe("NO_APLICA");
  });

  it("lote demo: el recordatorio INV-2210 ve el pago de las 09:14:10", async () => {
    expect((await delLote("INV-2210", "R2", 1)).comparacion).toBe("mismo emisor + número INV-2210 (pagada 09:14:10, REG-2026-000002)");
  });
});
