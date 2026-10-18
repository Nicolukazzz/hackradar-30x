import { describe, expect, it } from "vitest";

import { cargarDatosComunes } from "@/dominio/cargar";
import { citar, normalizarNombre, normalizarNumeroFactura, normalizarTexto, sinPuntoDoble } from "@/dominio/normalizar";

describe("normalizarNombre (mismos casos que el oráculo Python de #3)", () => {
  it.each([
    ["Servicios Ómicron S.A.", "SERVICIOS OMICRON"],
    ["CloudNorte S.A.S.", "CLOUDNORTE"],
    ["Grupo Alba Logística S.A. de C.V.", "GRUPO ALBA LOGISTICA"],
    ["Tecnologías Delta SpA", "TECNOLOGIAS DELTA"],
    ["Pixel & Co.", "PIXEL CO"],
    ["Rio Verde Traduções Ltda.", "RIO VERDE TRADUCOES"],
    ["  ana maría   gómez ", "ANA MARIA GOMEZ"],
    ["S.A.", "S A"],
  ])("%s → %s", (entrada, salida) => {
    expect(normalizarNombre(entrada)).toBe(salida);
  });

  it("los 14 beneficiarios permitidos quedan distintos entre sí", async () => {
    const { beneficiarios } = await cargarDatosComunes();
    const normalizados = beneficiarios.map((b) => normalizarNombre(b.nombre));
    expect(new Set(normalizados).size).toBe(beneficiarios.length);
  });
});

describe("normalizarNumeroFactura", () => {
  it.each([
    ["INV 2210", "INV-2210"],
    ["inv-2210", "INV-2210"],
    ["fac_1041", "FAC-1041"],
    [" LF-2026-10 ", "LF-2026-10"],
    ["Nº 0093", "N-0093"],
  ])("%s → %s", (entrada, salida) => {
    expect(normalizarNumeroFactura(entrada)).toBe(salida);
  });
});

it("normalizarTexto quita tildes y pasa a minúsculas", () => {
  expect(normalizarTexto("Procesar SIN REVISIÓN")).toBe("procesar sin revision");
});

describe("sinPuntoDoble y citar (#149)", () => {
  it("un nombre que termina en punto no deja «..» al cerrar la frase", () => {
    expect(sinPuntoDoble("quedará vinculado a CloudNorte S.A.S.. El agente")).toBe("quedará vinculado a CloudNorte S.A.S. El agente");
    expect(sinPuntoDoble("que te pasó Nébula Studio Inc..")).toBe("que te pasó Nébula Studio Inc.");
  });
  it("no toca puntos suspensivos ni frases normales", () => {
    expect(sinPuntoDoble("Espera...")).toBe("Espera...");
    expect(sinPuntoDoble("Pagada. Bajo el límite.")).toBe("Pagada. Bajo el límite.");
  });
  it("citar quita el punto final del comentario, salvo el de una abreviatura", () => {
    expect(citar("Se agregó a la lista permitida.")).toBe("«Se agregó a la lista permitida»");
    expect(citar("  Pago anual acordado ")).toBe("«Pago anual acordado»");
    expect(citar("Proveedor: Mesa Legal S.A.S.")).toBe("«Proveedor: Mesa Legal S.A.S.»");
  });
});
