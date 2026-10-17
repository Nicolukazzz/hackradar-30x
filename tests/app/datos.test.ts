import { describe, expect, it } from "vitest";

import { contarPendientes, obtenerAprobaciones } from "@/app/_datos/aprobaciones";

describe("_datos/aprobaciones (mock de GET /api/aprobaciones, §12)", () => {
  it("valida con zod y cuadra con el lote demo (§11.4): 4 escaladas, reservado USD 9.278,65", async () => {
    const r = await obtenerAprobaciones();
    expect(r.pendientes.map((p) => p.factura_numero)).toEqual(["F-0101", "OMI-3381", "LF-2026-10", "TD-001"]);
    expect(r.reservado_usd).toBe(927865);
    expect(r.pendientes.reduce((s, p) => s + (p.monto_usd_centavos ?? 0), 0)).toBe(r.reservado_usd);
    expect(await contarPendientes()).toBe(4);
  });
});
