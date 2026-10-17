import { describe, expect, it } from "vitest";

import { clasificarRuta, destinoTrasEntrar } from "@/lib/auth/rutas";

describe("destinoTrasEntrar", () => {
  it("sin siguiente va al inicio del rol", () => {
    expect(destinoTrasEntrar(null, "aprobador")).toBe("/");
    expect(destinoTrasEntrar(undefined, "proveedor")).toBe("/portal");
  });

  it("respeta una ruta interna", () => {
    expect(destinoTrasEntrar("/aprobaciones?orden=monto", "aprobador")).toBe("/aprobaciones?orden=monto");
  });

  it.each(["//malo.example", "/\\malo.example", "https://malo.example", "malo", "/entrar", "/entrar?siguiente=/"])(
    "rechaza %s",
    (siguiente) => {
      expect(destinoTrasEntrar(siguiente, "tesoreria")).toBe("/");
    },
  );
});

describe("clasificarRuta (proxy, chequeo optimista)", () => {
  it.each(["/entrar", "/entrar/codigo", "/sin-permiso"])("%s es pública", (ruta) => {
    expect(clasificarRuta(ruta, false)).toBe("seguir");
  });

  it("página protegida sin sesión → redirigir a /entrar", () => {
    expect(clasificarRuta("/", false)).toBe("redirigir");
    expect(clasificarRuta("/aprobaciones", false)).toBe("redirigir");
  });

  it("API sin sesión → 401", () => {
    expect(clasificarRuta("/api/bandeja", false)).toBe("no_autorizado");
  });

  it("con sesión sigue (el rol se verifica en el servidor, no aquí)", () => {
    expect(clasificarRuta("/", true)).toBe("seguir");
    expect(clasificarRuta("/api/bandeja", true)).toBe("seguir");
  });

  it("/entrarx no se confunde con /entrar", () => {
    expect(clasificarRuta("/entrarx", false)).toBe("redirigir");
  });
});
