import { beforeAll, describe, expect, it } from "vitest";

import type { DatosComunes } from "@/dominio/cargar";
import { r04Cuenta } from "@/reglas/r04-cuenta";

import { campo, ctx, datosComunes, delLote } from "./fixtures";

let d: DatosComunes;
beforeAll(async () => {
  d = await datosComunes();
});

describe("R4 Cuenta destino es la registrada", () => {
  it("CUMPLE con la cuenta registrada", () => {
    expect(r04Cuenta(ctx(d)).comparacion).toBe("3021 = 3021");
  });
  it("FALLA con otra cuenta", () => {
    const e = r04Cuenta(ctx(d, { ext: { cuenta_destino_ultimos4: campo("9999") } }));
    expect([e.resultado, e.comparacion]).toEqual(["FALLA", "9999 ≠ 3021"]);
  });
  it("NO_APLICA si R3 falla o la cuenta no es confiable", () => {
    expect(r04Cuenta(ctx(d, { ext: { beneficiario_nombre: campo("Nova Prints") } })).comparacion).toBe("beneficiario fuera de la lista (ver R3)");
    expect(r04Cuenta(ctx(d, { ext: { cuenta_destino_ultimos4: campo("3021", 0.5) } })).comparacion).toBe("sin dato confiable (ver R1)");
  });
  it("lote demo: F-0101 cambió de banco", async () => {
    expect((await delLote("F-0101", "R4")).comparacion).toBe("9083 ≠ 4471");
  });
});
