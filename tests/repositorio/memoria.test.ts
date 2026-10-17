import { describe, expect, it } from "vitest";

import { crearRepositorioMemoria } from "@/repositorio/memoria";

import { contratoRepositorio } from "./contrato";

describe("contrato del repositorio: memoria", () => {
  contratoRepositorio(() => crearRepositorioMemoria("lote-demo-oct"), { persistente: false });
});

describe("repositorio en memoria", () => {
  it("una ref entregada queda reservada aunque no se guarde el documento (nunca se reutiliza)", async () => {
    const repo = await crearRepositorioMemoria("lote-demo-oct", undefined, { lote: "vacio" });
    expect(await repo.siguienteRef(2026)).toBe("INT-2026-000001");
    expect(await repo.siguienteRef(2026)).toBe("INT-2026-000002");
  });
});
