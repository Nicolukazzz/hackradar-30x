import { describe, expect, it } from "vitest";

import type { Aprobador } from "@/dominio/tipos";
import {
  ErrorAuth,
  exigirAprobadorPara,
  exigirAprobadorPrincipal,
  exigirRol,
  puedeVerDocumento,
  type Sesion,
} from "@/lib/auth/permisos";

const aprobadores: Aprobador[] = [
  { id: "lm", nombre: "Laura Méndez", rol: "CFO", limite_usd: null, principal: true, iniciales: "LM" },
  { id: "ap", nombre: "Andrés Pardo", rol: "Analista de finanzas", limite_usd: 500000, principal: false, iniciales: "AP" },
];

function sesion(parcial: Partial<Sesion>): Sesion {
  return {
    usuario_id: "u-1",
    correo: "x@demo.nebula.example",
    rol: "tesoreria",
    aprobador_id: null,
    beneficiario_id: null,
    nombre: "Tesorería",
    ...parcial,
  };
}

const laura = sesion({ rol: "aprobador", aprobador_id: "lm", nombre: "Laura Méndez" });
const andres = sesion({ rol: "aprobador", aprobador_id: "ap", nombre: "Andrés Pardo" });
const pixel = sesion({ rol: "proveedor", beneficiario_id: "ben-pixel-co", nombre: "Pixel & Co." });

function fallaCon(fn: () => unknown, status: 401 | 403) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorAuth);
    expect((e as ErrorAuth).status).toBe(status);
    return;
  }
  throw new Error(`se esperaba ErrorAuth ${status}`);
}

describe("exigirRol", () => {
  it("sin sesión → 401", () => fallaCon(() => exigirRol(null, "tesoreria"), 401));

  it("rol que no está en la lista → 403", () => fallaCon(() => exigirRol(pixel, "tesoreria", "aprobador"), 403));

  it("rol permitido devuelve la misma sesión", () => {
    expect(exigirRol(laura, "tesoreria", "aprobador")).toBe(laura);
  });
});

describe("exigirAprobadorPara (§10)", () => {
  it("Andrés no puede aprobar USD 6.000 → 403", () => fallaCon(() => exigirAprobadorPara(andres, 600000, aprobadores), 403));

  it("Andrés sí puede aprobar USD 5.000 (límite exacto)", () => {
    expect(exigirAprobadorPara(andres, 500000, aprobadores).id).toBe("ap");
  });

  it("Laura sin límite aprueba cualquier monto", () => {
    expect(exigirAprobadorPara(laura, 1_400_000, aprobadores).id).toBe("lm");
  });

  it("tesorería no aprueba → 403", () => fallaCon(() => exigirAprobadorPara(sesion({}), 1000, aprobadores), 403));

  it("aprobador_id de la sesión que no existe en aprobadores.json → 403", () =>
    fallaCon(() => exigirAprobadorPara(sesion({ rol: "aprobador", aprobador_id: "zz" }), 1000, aprobadores), 403));

  it("sin sesión → 401", () => fallaCon(() => exigirAprobadorPara(null, 1000, aprobadores), 401));

  it("el mensaje de límite es el de §10", () => {
    expect(() => exigirAprobadorPara(andres, 600000, aprobadores)).toThrow("Supera tu límite de aprobación");
  });
});

describe("exigirAprobadorPrincipal (guardar reglas)", () => {
  it("Laura (principal) pasa", () => {
    expect(exigirAprobadorPrincipal(laura, aprobadores).id).toBe("lm");
  });

  it("Andrés (no principal) → 403", () => fallaCon(() => exigirAprobadorPrincipal(andres, aprobadores), 403));

  it("tesorería → 403", () => fallaCon(() => exigirAprobadorPrincipal(sesion({}), aprobadores), 403));
});

describe("puedeVerDocumento", () => {
  it("proveedor ve sus propios documentos", () => {
    expect(puedeVerDocumento(pixel, "ben-pixel-co")).toBe(true);
  });

  it("proveedor no ve documentos de otro beneficiario", () => {
    expect(puedeVerDocumento(pixel, "ben-ana-maria-gomez")).toBe(false);
  });

  it("proveedor no ve documentos sin beneficiario vinculado", () => {
    expect(puedeVerDocumento(pixel, null)).toBe(false);
  });

  it("proveedor sin beneficiario_id no ve nada", () => {
    expect(puedeVerDocumento(sesion({ rol: "proveedor" }), null)).toBe(false);
  });

  it("tesorería y aprobadores ven todo", () => {
    expect(puedeVerDocumento(sesion({}), "ben-pixel-co")).toBe(true);
    expect(puedeVerDocumento(andres, null)).toBe(true);
  });

  it("sin sesión no ve nada", () => {
    expect(puedeVerDocumento(null, "ben-pixel-co")).toBe(false);
  });
});
