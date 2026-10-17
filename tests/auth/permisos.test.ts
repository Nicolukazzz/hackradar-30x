import { describe, expect, it } from "vitest";

import { ErrorAuth, exigirSesion, type Sesion } from "@/lib/auth/permisos";

const ana: Sesion = { usuario_id: "u-1", correo: "ana@empresa.example", nombre: "Ana" };

describe("exigirSesion", () => {
  it("sin sesión → 401", () => {
    expect(() => exigirSesion(null)).toThrow(ErrorAuth);
    try {
      exigirSesion(null);
    } catch (e) {
      expect((e as ErrorAuth).status).toBe(401);
    }
  });

  it("con sesión devuelve la misma sesión", () => {
    expect(exigirSesion(ana)).toBe(ana);
  });
});
