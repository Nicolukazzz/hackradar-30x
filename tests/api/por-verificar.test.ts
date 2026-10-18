// Bandeja: recuadro «Por verificar» (R3/R11 pendientes) y novedades para que la pantalla se actualice sola.

import { describe, expect, it, vi } from "vitest";

import { decidir } from "@/aprobaciones/decidir";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import { procesarPendientes } from "@/servicios/lote";
import { novedades, porVerificar } from "@/servicios/verificar";

vi.mock("server-only", () => ({}));

describe("por verificar", () => {
  it("lote demo: TD-001 y OMI-3381 (proveedores nuevos) con quién escribió; resueltas salen de la lista", async () => {
    const repo = await crearRepositorioMemoria("lote-demo-oct");
    await procesarPendientes(repo);
    const filas = await porVerificar(repo);
    expect(filas.map((f) => [f.factura_numero, f.motivo])).toEqual([
      ["OMI-3381", "proveedor_nuevo"],
      ["TD-001", "proveedor_nuevo"],
    ]);
    expect(filas[1]?.remitente).toEqual({ tipo: "correo", valor: "ventas@tecnologiasdelta.example" });
    await decidir({ ref: filas[1]!.ref_interna, accion: "rechazar", comentario: "No lo conocemos", aprobador_id: "lm" }, { repo, ahora: "2026-10-16T15:00:00-05:00" });
    expect((await porVerificar(repo)).map((f) => f.factura_numero)).toEqual(["OMI-3381"]);
  });

  it("trampas: INV-2245 es un proveedor conocido que escribió desde otro correo", async () => {
    const repo = await crearRepositorioMemoria("trampas-extra");
    await procesarPendientes(repo);
    expect((await porVerificar(repo)).find((f) => f.factura_numero === "INV-2245")).toMatchObject({
      motivo: "remitente_no_vinculado",
      remitente: { tipo: "correo", valor: "pagos-cloudnorte@gmail.example" },
    });
  });

  it("novedades cuenta las decisiones del agente y dice la última", async () => {
    const repo = await crearRepositorioMemoria("lote-demo-oct");
    const antes = await novedades(repo);
    await procesarPendientes(repo);
    const despues = await novedades(repo);
    expect(despues.total - antes.total).toBe(12);
    expect(despues.ultima).toBe("INT-2026-000012");
  });
});
