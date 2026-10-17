import { describe, expect, it } from "vitest";

import type { Empresa } from "@/dominio/tipos";
import { describirCambio, EsquemaCambiosEmpresa, resumenOperacion } from "@/empresa/datos";

const EMPRESA: Empresa = {
  id: "nebula",
  nombre: "Nébula Studio Inc.",
  jurisdiccion: "Delaware, EE. UU.",
  paises_operacion: ["US", "CO", "MX", "AR", "BR"],
  moneda_base: "USD",
  zona_horaria: "America/Bogota",
};

describe("EsquemaCambiosEmpresa (#84)", () => {
  it("acepta cualquier subconjunto; recorta espacios y ordena los países como la lista", () => {
    expect(EsquemaCambiosEmpresa.parse({ nombre: "  Orbita   Labs  " })).toEqual({ nombre: "Orbita Labs" });
    expect(EsquemaCambiosEmpresa.parse({ paises_operacion: ["BR", "US", "BR"] })).toEqual({ paises_operacion: ["US", "BR"] });
  });

  it("rechaza vacío, campos ajenos, países fuera de la lista y textos largos", () => {
    expect(EsquemaCambiosEmpresa.safeParse({}).success).toBe(false);
    expect(EsquemaCambiosEmpresa.safeParse({ nombre: "   " }).success).toBe(false);
    expect(EsquemaCambiosEmpresa.safeParse({ moneda_base: "COP" }).success).toBe(false);
    expect(EsquemaCambiosEmpresa.safeParse({ id: "otra" }).success).toBe(false);
    expect(EsquemaCambiosEmpresa.safeParse({ paises_operacion: [] }).success).toBe(false);
    expect(EsquemaCambiosEmpresa.safeParse({ paises_operacion: ["XX"] }).success).toBe(false);
    expect(EsquemaCambiosEmpresa.safeParse({ jurisdiccion: "x".repeat(121) }).success).toBe(false);
  });
});

describe("describirCambio", () => {
  it("nombra solo lo que cambió, con quién", () => {
    expect(describirCambio(EMPRESA, { ...EMPRESA, nombre: "Orbita Labs" }, "Ana Torres (ana@x.example)")).toBe(
      "Ana Torres (ana@x.example) cambió el nombre de «Nébula Studio Inc.» a «Orbita Labs».",
    );
    expect(describirCambio(EMPRESA, { ...EMPRESA, jurisdiccion: "Texas", paises_operacion: ["US"] }, "Ana")).toBe(
      "Ana cambió la jurisdicción de «Delaware, EE. UU.» a «Texas» y los países de operación de Estados Unidos, Colombia, México, Argentina, Brasil a Estados Unidos.",
    );
    expect(describirCambio(EMPRESA, { ...EMPRESA }, "Ana")).toBeNull();
  });

  it("resumen de la barra lateral", () => {
    expect(resumenOperacion(EMPRESA)).toBe("Delaware, EE. UU. · opera en 5 países");
    expect(resumenOperacion({ jurisdiccion: "", paises_operacion: ["US"] })).toBe("opera en 1 país");
  });
});
