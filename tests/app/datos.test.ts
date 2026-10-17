import { describe, expect, it, vi } from "vitest";

import { contarPendientes, obtenerAprobaciones } from "@/app/_datos/aprobaciones";
import { obtenerBandeja } from "@/app/_datos/bandeja";
import { fijarRepositorio } from "@/repositorio";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import { procesarPendientes } from "@/servicios/lote";

import { CUENTA, comoCuenta, comoSesion } from "../api/ayuda";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/sesion", async () => (await import("../api/ayuda")).sesionFalsa);

describe("_datos/aprobaciones (mismo servicio que GET /api/aprobaciones)", () => {
  it("sin lote procesado no hay pendientes; tras procesar, las 4 escaladas del lote demo (reservado USD 9.278,65)", async () => {
    const repo = await crearRepositorioMemoria("lote-demo-oct");
    fijarRepositorio(repo);
    comoSesion(CUENTA);
    expect(await contarPendientes()).toBe(0);
    await procesarPendientes(repo);
    const r = await obtenerAprobaciones();
    expect(r.pendientes.map((p) => p.factura_numero)).toEqual(["F-0101", "OMI-3381", "LF-2026-10", "TD-001"]);
    expect(r.reservado_usd).toBe(927865);
    expect(await contarPendientes()).toBe(4);
  });
});

describe("_datos exige ser miembro (#51)", () => {
  // Next no vuelve a renderizar el layout del panel en navegaciones del cliente: la puerta está en _datos.
  it("sin empresa → redirige a /sin-permiso; sin sesión → /entrar; nunca devuelve datos", async () => {
    fijarRepositorio(await crearRepositorioMemoria("lote-demo-oct"));
    comoCuenta("Nadie", null);
    await expect(obtenerBandeja()).rejects.toMatchObject({ digest: expect.stringContaining("/sin-permiso") });
    await expect(obtenerAprobaciones()).rejects.toMatchObject({ digest: expect.stringContaining("/sin-permiso") });
    comoSesion(null);
    await expect(obtenerBandeja()).rejects.toMatchObject({ digest: expect.stringContaining("/entrar") });
    comoCuenta("Tere", "tesoreria");
    expect((await obtenerBandeja()).kpis).toBeDefined();
  });
});
