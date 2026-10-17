import { describe, expect, it } from "vitest";

import { instante, relojFijo } from "@/dominio/reloj";
import { relojSistema } from "@/lib/reloj-sistema";

describe("reloj", () => {
  it("relojFijo devuelve siempre el mismo momento", () => {
    const r = relojFijo("2026-10-16T09:24:00-05:00");
    expect(r.ahora()).toBe("2026-10-16T09:24:00-05:00");
    expect(r.ahora()).toBe(r.ahora());
  });

  it("relojFijo rechaza momentos sin zona", () => {
    expect(() => relojFijo("2026-10-16T09:24:00")).toThrow("momento inválido");
    expect(() => relojFijo("16/10/2026")).toThrow("momento inválido");
  });

  it("relojFijo rechaza fechas imposibles", () => {
    expect(() => relojFijo("2026-13-45T99:99:99Z")).toThrow("momento inválido");
  });

  it("instante ordena por tiempo real entre zonas", () => {
    expect(instante("2026-10-16T14:15:00Z")).toBeLessThan(instante("2026-10-16T09:20:00-05:00"));
  });

  it("relojSistema usa el formato del registro en hora de Bogotá", () => {
    expect(relojSistema().ahora()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-05:00$/);
  });
});
