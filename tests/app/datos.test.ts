import { describe, expect, it } from "vitest";

import { contarPendientes, obtenerAprobaciones } from "@/app/_datos/aprobaciones";
import { fijarRepositorio } from "@/repositorio";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import { procesarPendientes } from "@/servicios/lote";

describe("_datos/aprobaciones (mismo servicio que GET /api/aprobaciones)", () => {
  it("sin lote procesado no hay pendientes; tras procesar, las 4 escaladas del lote demo (reservado USD 9.278,65)", async () => {
    const repo = await crearRepositorioMemoria("lote-demo-oct");
    fijarRepositorio(repo);
    expect(await contarPendientes()).toBe(0);
    await procesarPendientes(repo);
    const r = await obtenerAprobaciones();
    expect(r.pendientes.map((p) => p.factura_numero)).toEqual(["F-0101", "OMI-3381", "LF-2026-10", "TD-001"]);
    expect(r.reservado_usd).toBe(927865);
    expect(await contarPendientes()).toBe(4);
  });
});
