import { beforeAll, describe, expect, it } from "vitest";

import type { DatosComunes } from "@/dominio/cargar";
import { r03Beneficiario } from "@/reglas/r03-beneficiario";

import { beneficiario, campo, ctx, datosComunes, delLote } from "./fixtures";

let d: DatosComunes;
beforeAll(async () => {
  d = await datosComunes();
});

describe("R3 Beneficiario en la lista permitida", () => {
  it("CUMPLE si está activo", () => {
    expect(r03Beneficiario(ctx(d)).comparacion).toBe("Ana María Gómez está entre los 14 permitidos");
  });

  it("FALLA si no está en la lista", () => {
    const e = r03Beneficiario(ctx(d, { ext: { beneficiario_nombre: campo("Nova Prints") } }));
    expect(e.resultado).toBe("FALLA");
    expect(e.comparacion).toBe("Nova Prints no está entre los 14 permitidos");
  });

  it("FALLA si está inactivo", () => {
    const inactivo = { ...beneficiario(d, "Ana María Gómez"), estado: "inactivo" as const };
    expect(r03Beneficiario(ctx(d, { beneficiario: inactivo })).comparacion).toBe("Ana María Gómez está inactivo en la lista");
  });

  it("si falla, FRENA (solo se paga a proveedores de la lista); por el portal o un enlace de invitación escala", () => {
    const nova = { ext: { beneficiario_nombre: campo("Nova Prints") } };
    const porCorreo = { canal: "correo" as const, remitente: { tipo: "correo" as const, valor: "ventas@novaprints.example" } };
    expect(r03Beneficiario(ctx(d, { ...nova, doc: porCorreo })).si_falla).toBe("FRENAR");
    expect(r03Beneficiario(ctx(d, { ...nova, doc: { canal: "portal" } })).si_falla).toBe("ESCALAR");
    expect(r03Beneficiario(ctx(d, { ...nova, doc: { ...porCorreo, remitente: { tipo: "correo", valor: "invitacion:abc:nova@prints.example" } } })).si_falla).toBe("ESCALAR");
  });

  it("nombre ilegible o ausente: INDETERMINADO (escala por lectura, nunca se niega por un error del agente)", () => {
    const ilegible = r03Beneficiario(ctx(d, { ext: { beneficiario_nombre: campo("Nova Prints", 0.4) } }));
    expect(ilegible).toMatchObject({ resultado: "INDETERMINADO", comparacion: "no se pudo leer con confianza el nombre de quien cobra (ver R1)" });
    const sinNombre = r03Beneficiario(ctx(d, { ext: { beneficiario_nombre: campo<string>(null) } }));
    expect(sinNombre.resultado).toBe("INDETERMINADO");
  });

  it("lote demo: OMI-3381", async () => {
    expect((await delLote("OMI-3381", "R3")).comparacion).toBe("Servicios Ómicron S.A. no está entre los 14 permitidos");
  });
});
