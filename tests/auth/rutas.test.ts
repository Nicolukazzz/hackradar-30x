import { describe, expect, it } from "vitest";

import { API_PUBLICAS, clasificarRuta, destinoTrasEntrar } from "@/lib/auth/rutas";

describe("destinoTrasEntrar", () => {
  it("sin siguiente va a la bandeja", () => {
    expect(destinoTrasEntrar(null)).toBe("/");
    expect(destinoTrasEntrar(undefined)).toBe("/");
  });

  it("respeta una ruta interna", () => {
    expect(destinoTrasEntrar("/aprobaciones?orden=monto")).toBe("/aprobaciones?orden=monto");
  });

  it.each(["//malo.example", "/\\malo.example", "https://malo.example", "malo", "/entrar", "/entrar?siguiente=/"])(
    "rechaza %s",
    (siguiente) => {
      expect(destinoTrasEntrar(siguiente)).toBe("/");
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

  it("con sesión sigue (la sesión se verifica de nuevo en el servidor)", () => {
    expect(clasificarRuta("/", true)).toBe("seguir");
    expect(clasificarRuta("/api/bandeja", true)).toBe("seguir");
  });

  it("API pública declarada sigue sin sesión (la ruta verifica por su cuenta)", () => {
    expect(clasificarRuta("/api/telegram", false, ["/api/telegram"])).toBe("seguir");
    expect(clasificarRuta("/api/telegram/webhook", false, ["/api/telegram"])).toBe("seguir");
    expect(clasificarRuta("/api/telegramx", false, ["/api/telegram"])).toBe("no_autorizado");
  });

  it("por defecto usa API_PUBLICAS", () => {
    for (const p of API_PUBLICAS) expect(clasificarRuta(p, false)).toBe("seguir");
    expect(clasificarRuta("/api/bandeja", false)).toBe("no_autorizado");
  });

  it("/entrarx no se confunde con /entrar", () => {
    expect(clasificarRuta("/entrarx", false)).toBe("redirigir");
  });
});
