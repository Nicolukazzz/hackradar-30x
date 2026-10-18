// #108: cómo se reconoce a quien cobra (nombre, nombre + NIT, solo NIT).

import { beforeAll, describe, expect, it } from "vitest";

import type { DatosComunes } from "@/dominio/cargar";
import type { Beneficiario } from "@/dominio/tipos";
import { parsearLineas } from "@/extraccion/parsers/etiquetas";
import { explicar } from "@/reglas/explicar";
import { identificar } from "@/reglas/identidad";
import { r03Beneficiario } from "@/reglas/r03-beneficiario";

import { campo, ctx, datosComunes } from "./fixtures";

let d: DatosComunes;
let mesa: Beneficiario;
beforeAll(async () => {
  d = await datosComunes();
  mesa = { ...d.beneficiarios.find((b) => b.id === "ben-mesa-legal")!, identificacion_fiscal: "900.123.456-7" };
});

const lista = () => d.beneficiarios.map((b) => (b.id === mesa.id ? mesa : b));
const ext = (nombre: string | null, nit: string | null, confianza = 0.99) => {
  const base = ctx(d).ext;
  return { ...base, beneficiario_nombre: campo(nombre), ...(nit ? { identificacion_fiscal: campo(nit, confianza) } : {}) };
};

describe("identificar (#108)", () => {
  it("por nombre: como siempre, el NIT no importa", () => {
    expect(identificar(ext("MESA LEGAL", null), lista(), "nombre", 0.9)).toMatchObject({ motivo: "ok", beneficiario: { id: "ben-mesa-legal" } });
  });

  it("solo NIT: manda la identificación, aunque el nombre venga distinto; sin NIT confiable no se adivina", () => {
    expect(identificar(ext("Mesa Legal Abogados", "9001234567"), lista(), "nit", 0.9)).toMatchObject({ motivo: "ok", beneficiario: { id: "ben-mesa-legal" } });
    expect(identificar(ext("Mesa Legal", null), lista(), "nit", 0.9)).toMatchObject({ motivo: "sin_nit_factura", beneficiario: null });
    expect(identificar(ext("Mesa Legal", "900123456-7", 0.5), lista(), "nit", 0.9).motivo).toBe("sin_nit_factura");
    expect(identificar(ext("Mesa Legal", "800.000.000-1"), lista(), "nit", 0.9)).toMatchObject({ motivo: "no_esta", beneficiario: null });
  });

  it("nombre y NIT: los dos del mismo proveedor", () => {
    expect(identificar(ext("Mesa Legal S.A.S.", "900.123.456-7"), lista(), "nombre_y_nit", 0.9).motivo).toBe("ok");
    expect(identificar(ext("Mesa Legal S.A.S.", "800.000.000-1"), lista(), "nombre_y_nit", 0.9)).toMatchObject({ motivo: "nit_distinto", beneficiario: null, candidato: { id: "ben-mesa-legal" } });
    expect(identificar(ext("Mesa Legal S.A.S.", null), lista(), "nombre_y_nit", 0.9).motivo).toBe("sin_nit_factura");
    expect(identificar(ext("CloudNorte S.A.S.", "900.555.555-5"), lista(), "nombre_y_nit", 0.9).motivo).toBe("sin_nit_registrado");
  });
});

describe("R3 con identidad (#108)", () => {
  const r3 = (nombre: string, nit: string | null, modo: "nombre" | "nombre_y_nit" | "nit", confianza = 0.99) => {
    const e = ext(nombre, nit, confianza);
    const identidad = identificar(e, lista(), modo, 0.9);
    return r03Beneficiario({ ...ctx(d, { ext: e }), beneficiario: identidad.beneficiario, identidad });
  };

  it("NIT distinto o faltante frena (falla); un NIT ilegible queda indeterminado (escala por lectura)", () => {
    const distinto = r3("Mesa Legal S.A.S.", "800.000.000-1", "nombre_y_nit");
    expect(distinto.resultado).toBe("FALLA");
    expect(distinto.comparacion).toBe("NIT 800.000.000-1 ≠ 900.123.456-7 registrado para Mesa Legal S.A.S.");
    expect(distinto.si_falla).toBe("FRENAR");
    const falta = r3("Mesa Legal S.A.S.", null, "nit");
    expect(falta.resultado).toBe("FALLA");
    expect(falta.comparacion).toBe("la factura no trae la identificación fiscal y la empresa reconoce a quien cobra por NIT");
    const ilegible = r3("Mesa Legal S.A.S.", "900.123.456-7", "nit", 0.5);
    expect(ilegible.resultado).toBe("INDETERMINADO");
    expect(ilegible.comparacion).toBe("no se pudo leer con confianza la identificación fiscal (NIT) (ver R1)");
    expect(r3("Otro Nombre", "900.123.456-7", "nit")).toMatchObject({ resultado: "CUMPLE", comparacion: "Mesa Legal S.A.S. (NIT 900.123.456-7) está entre los 14 permitidos" });
  });

  it("la explicación dice qué identificación no coincide", () => {
    const e = ext("Mesa Legal S.A.S.", "800.000.000-1");
    const identidad = identificar(e, lista(), "nombre_y_nit", 0.9);
    const c = { ...ctx(d, { ext: e }), beneficiario: null, identidad };
    const texto = explicar({ decision: "ESCALAR", evaluaciones: [r03Beneficiario(c)], doc: c.doc, ext: e, beneficiario: null, monto_usd_centavos: null, reglas: c.reglas, ahora: c.ahora });
    expect(texto).toContain("la identificación fiscal de la factura (800.000.000-1) no es la registrada para Mesa Legal S.A.S. (900.123.456-7)");
  });
});

describe("parser: identificación fiscal de quien cobra (#108)", () => {
  it("toma la del encabezado e ignora la del cliente", () => {
    const r = parsearLineas(["Estudio Nuevo S.A.S.", "NIT 900.123.456-7", "FACTURA N.º FE-12", "Facturar a", "Nébula Studio Inc.", "NIT: 901.999.888-1", "Total | USD 1.000,00"], "documento");
    expect(r.identificacion_fiscal).toMatchObject({ valor: "900.123.456-7", confianza: 0.99 });
  });

  it("dos identificaciones distintas fuera del bloque del cliente: confianza baja", () => {
    const r = parsearLineas(["NIT 900.123.456-7", "RUT 76.543.210-K"], "documento");
    expect(r.identificacion_fiscal?.confianza).toBe(0.5);
  });
});
