import { beforeAll, describe, expect, it } from "vitest";

import type { DatosComunes } from "@/dominio/cargar";
import { r11Remitente } from "@/reglas/r11-remitente";

import { campo, ctx, datosComunes, delLote } from "./fixtures";

let d: DatosComunes;
beforeAll(async () => {
  d = await datosComunes();
});

describe("R11 Remitente verificado", () => {
  it("CUMPLE con sesión de portal del beneficiario", () => {
    expect(r11Remitente(ctx(d)).comparacion).toBe("sesión de portal ana.gomez vinculado a Ana María Gómez");
  });
  it("CUMPLE con correo vinculado (sin importar mayúsculas)", () => {
    const e = r11Remitente(ctx(d, { doc: { canal: "correo", remitente: { tipo: "correo", valor: "Ana.Gomez@amg-estudio.example" } } }));
    expect(e.resultado).toBe("CUMPLE");
  });
  it("FALLA si el remitente es de otro beneficiario (suplantación)", () => {
    const e = r11Remitente(ctx(d, { doc: { canal: "telegram", remitente: { tipo: "telegram", valor: "700100003" }, beneficiario_remitente_id: "ben-diego-herrera" } }));
    expect([e.resultado, e.comparacion]).toEqual(["FALLA", "700100003 no está vinculado a Ana María Gómez"]);
  });
  it("interno: CUMPLE solo si el beneficiario está en la lista", () => {
    const interno = { canal: "carga_manual" as const, remitente: { tipo: "interno" as const, valor: "cuentas@nebula.example" } };
    expect(r11Remitente(ctx(d, { doc: interno })).resultado).toBe("CUMPLE");
    expect(r11Remitente(ctx(d, { doc: interno, ext: { beneficiario_nombre: campo("Nova Prints") } })).resultado).toBe("FALLA");
  });
  it("beneficiario desconocido: vinculado a otro o a ninguno", () => {
    const fuera = { beneficiario_nombre: campo("Nova Prints") };
    expect(r11Remitente(ctx(d, { ext: fuera, doc: { beneficiario_remitente_id: "ben-ana-maria-gomez" } })).comparacion)
      .toBe("ana.gomez está vinculado a otro beneficiario, no a Nova Prints");
  });
  it("lote demo: TD-001", async () => {
    expect((await delLote("TD-001", "R11")).comparacion).toBe("ventas@tecnologiasdelta.example no está vinculado a ningún beneficiario");
  });
});
