import { describe, expect, it } from "vitest";

import type { EntradaRegistro } from "@/dominio/tipos";
import * as registro from "@/registro/registro";

const con = (id: string) => ({ id }) as EntradaRegistro;

describe("registro append-only (§9)", () => {
  it("ids consecutivos por año, ignorando el historial importado", () => {
    expect(registro.siguienteIdRegistro([], "2026")).toBe("REG-2026-000001");
    expect(registro.siguienteIdRegistro([con("REG-HIST-0009"), con("REG-2026-000012"), con("REG-2026-000003")], "2026")).toBe("REG-2026-000013");
    expect(registro.siguienteIdRegistro([con("REG-2025-000099")], "2026")).toBe("REG-2026-000001");
  });

  it("chips de comparación sin la unidad final", () => {
    expect(registro.chip("R9", "4.500,00 > 3.000,00 USD")).toBe("R9 · 4.500,00 > 3.000,00");
    expect(registro.chip("R7", "4.000,00 > 2.277,30 USD disponibles al evaluar")).toBe("R7 · 4.000,00 > 2.277,30");
    expect(registro.chip("R4", "9083 ≠ 4471")).toBe("R4 · 9083 ≠ 4471");
  });

  it("el módulo no expone funciones para editar ni borrar", () => {
    expect(Object.keys(registro).filter((k) => /editar|actualizar|update|borrar|eliminar|delete/i.test(k))).toEqual([]);
  });
});
