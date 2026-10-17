import { describe, expect, it } from "vitest";

import { ErrorAuth, exigirPermiso, exigirSesion, puede, ROLES, type Permiso, type Sesion } from "@/lib/auth/permisos";

const ana: Sesion = { usuario_id: "u-1", correo: "ana@empresa.example", nombre: "Ana", rol: "admin", limite_aprobacion_usd: null };

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

describe("permisos por rol (#51)", () => {
  const permisos: Permiso[] = ["ver", "aprobar", "editar_reglas", "administrar"];
  const tabla = (rol: Sesion["rol"]) => permisos.filter((p) => puede({ ...ana, rol }, p));

  it("admin todo · aprobador ve y aprueba · tesorería solo ve · sin empresa nada", () => {
    expect(ROLES).toEqual(["admin", "aprobador", "tesoreria"]);
    expect(tabla("admin")).toEqual(permisos);
    expect(tabla("aprobador")).toEqual(["ver", "aprobar"]);
    expect(tabla("tesoreria")).toEqual(["ver"]);
    expect(tabla(null)).toEqual([]);
  });

  it("exigirPermiso: 403 que dice qué falta", () => {
    expect(() => exigirPermiso({ ...ana, rol: null }, "ver")).toThrow("no pertenece a la empresa");
    expect(() => exigirPermiso({ ...ana, rol: "tesoreria" }, "aprobar")).toThrow("no permite aprobar");
    expect(() => exigirPermiso({ ...ana, rol: "aprobador" }, "editar_reglas")).toThrow("Solo un administrador");
    expect(exigirPermiso(ana, "administrar")).toBe(ana);
  });
});
