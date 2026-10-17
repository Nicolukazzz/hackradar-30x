import { beforeAll, describe, expect, it } from "vitest";

import { cargarEscenario, type DatosComunes, reglasVersion } from "@/dominio/cargar";
import type { EntradaRegistro } from "@/dominio/tipos";
import { asignarAprobador, responderAntesDe } from "@/reglas/asignacion";
import { evaluacion } from "@/reglas/catalogo";
import { combinar } from "@/reglas/combinar";
import { facturasVigentes, periodoDe } from "@/reglas/libro";
import { aplicar, estadoInicial, porBeneficiario } from "@/reglas/presupuesto";

import { datosComunes } from "./fixtures";

let d: DatosComunes;
let historial: EntradaRegistro[];
beforeAll(async () => {
  d = await datosComunes();
  historial = (await cargarEscenario("lote-demo-oct")).historial;
});

describe("presupuesto (§6)", () => {
  it("octubre arranca con USD 41.000 pagados y nada reservado", () => {
    const e = estadoInicial(historial, reglasVersion(d, 7), "2026-10");
    expect(e).toMatchObject({ pagado_antes: 4100000, reservado: 0, disponible: 1900000 });
  });

  it("PAGAR suma a pagado, ESCALAR a reservado, FRENAR no cambia", () => {
    const e0 = estadoInicial([], reglasVersion(d, 7), "2026-10");
    const e1 = aplicar(e0, "PAGAR", 1000);
    const e2 = aplicar(e1, "ESCALAR", 500);
    expect([e1.disponible, e2.disponible, aplicar(e2, "FRENAR", 9999).disponible]).toEqual([5999000, 5998500, 5998500]);
  });

  it("si no se cuentan los escalados, la reserva no descuenta", () => {
    const v7 = reglasVersion(d, 7);
    const sin = { ...v7, presupuesto: { ...v7.presupuesto, contar_escalado_como_reservado: false } };
    expect(aplicar(estadoInicial([], sin, "2026-10"), "ESCALAR", 500).disponible).toBe(6000000);
  });

  it("historial: aprobada → pagada, rechazada → fuera, 1 de 2 firmas → sigue contando", () => {
    const vigentes = facturasVigentes(historial);
    expect(vigentes.find((f) => f.numero === "KX-090")?.estado).toBe("pagada");
    expect(vigentes.find((f) => f.numero === "BR-12")).toBeUndefined();
    expect(vigentes.find((f) => f.numero === "PH-0441")?.estado).toBe("pagada");
    expect(porBeneficiario(historial, "2026-10", "mensual", "Pampa Hardware S.A.")).toBe(1610000);
  });

  it("periodos", () => {
    expect(periodoDe("2026-10-16T09:00:00-05:00")).toBe("2026-10");
    expect(periodoDe("2026-10-16T09:00:00-05:00", "quincenal")).toBe("2026-10-Q2");
    expect(periodoDe("2026-11-02T09:00:00-05:00", "trimestral")).toBe("2026-T4");
  });
});

describe("asignación (§10)", () => {
  const ev = (id: "R9" | "R10" | "R3", resultado: "FALLA" | "CUMPLE") => evaluacion(id, resultado, "");
  it("CFO si falla R9 o R10 o el monto supera el límite del analista", () => {
    expect(asignarAprobador([ev("R9", "FALLA")], 100, d.aprobadores)).toBe("lm");
    expect(asignarAprobador([ev("R10", "FALLA")], 100, d.aprobadores)).toBe("lm");
    expect(asignarAprobador([ev("R3", "FALLA")], 500001, d.aprobadores)).toBe("lm");
    expect(asignarAprobador([ev("R3", "FALLA")], 500000, d.aprobadores)).toBe("ap");
  });
  it("plazo: vence − 3 días a las 12:00, o hoy 18:00 si ya pasó", () => {
    expect(responderAntesDe("2026-10-21", "2026-10-16T09:24:00-05:00")).toBe("2026-10-18T12:00:00-05:00");
    expect(responderAntesDe("2026-10-19", "2026-10-16T09:24:00-05:00")).toBe("2026-10-16T18:00:00-05:00");
    expect(responderAntesDe(null, "2026-10-16T09:24:00-05:00")).toBe("2026-10-16T18:00:00-05:00");
    expect(responderAntesDe("2026-11-02", "2026-10-30T09:00:00-05:00")).toBe("2026-10-30T18:00:00-05:00");
  });
});

describe("combinar (§5)", () => {
  const todas = (resultado: "CUMPLE" | "NO_APLICA") =>
    (["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11"] as const).map((id) => evaluacion(id, resultado, ""));
  it("todas CUMPLE → PAGAR; frenar pesa más que escalar", () => {
    expect(combinar(todas("CUMPLE"), 100).decision).toBe("PAGAR");
    const mezcla = todas("CUMPLE").map((e) => (e.id === "R9" ? { ...e, resultado: "FALLA" as const } : e.id === "R7" ? { ...e, resultado: "FALLA" as const } : e));
    expect(combinar(mezcla, 100)).toEqual({ decision: "FRENAR", reglas_que_fallaron: ["R7", "R9"] });
  });
  it("INDETERMINADO en regla de frenar escala", () => {
    const ind = todas("CUMPLE").map((e) => (e.id === "R5" ? { ...e, resultado: "INDETERMINADO" as const } : e));
    expect(combinar(ind, 100).decision).toBe("ESCALAR");
  });
  it("guardas: NO_APLICA en R1/R3/R4/R6/R7/R9/R11, sin monto o traza incompleta → nunca PAGAR", () => {
    expect(combinar(todas("NO_APLICA"), 100).decision).toBe("ESCALAR");
    expect(combinar(todas("CUMPLE"), null).decision).toBe("ESCALAR");
    expect(combinar(todas("CUMPLE").slice(0, 10), 100).decision).toBe("ESCALAR");
  });
});

describe("libro: casos borde", () => {
  it("una escalada sin nombre legible sigue reservando presupuesto", () => {
    const sinNombre = { ...historial.find((e) => e.factura_numero === "KX-090")!, id: "REG-2026-000099", beneficiario: null };
    const e = estadoInicial([sinNombre], reglasVersion(d, 7), "2026-10");
    expect(e.reservado).toBe(340000);
  });
});
