import { describe, expect, it } from "vitest";

import { leerUsd } from "@/app/(panel)/_reglas/numeros";

describe("leerUsd (editor de reglas)", () => {
  it.each([
    ["3.000,00", 300000],
    ["3000", 300000],
    ["3.000", 300000],
    ["3000,5", 300050],
    ["3000.50", 300050], // punto decimal sin coma: no se lee como miles (antes daba USD 300.050)
    ["1.5", 150],
    ["USD 15.000,00", 1500000],
  ])("«%s» → %i centavos", (texto, centavos) => {
    expect(leerUsd(texto)).toBe(centavos);
  });

  it.each(["", "abc", "-5", "3,000,00"])("«%s» no es un monto", (texto) => {
    expect(leerUsd(texto)).toBeNull();
  });
});
