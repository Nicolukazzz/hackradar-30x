import { describe, expect, it } from "vitest";

import { ErrorAuth, exigirRol, type Sesion } from "@/lib/auth/permisos";

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
