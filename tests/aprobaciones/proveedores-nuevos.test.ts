// «¿Confiar siempre en este proveedor?» (2026-10-18): reemplaza la casilla «Agregar a la lista» al aprobar una factura.

import { describe, expect, it, vi } from "vitest";

import { confiarEnProveedor, proveedoresPorConfirmar } from "@/aprobaciones/proveedores-nuevos";
import type { Aprobador } from "@/dominio/tipos";
import type { Repositorio } from "@/repositorio/repositorio";
import { obtenerAprobaciones } from "@/servicios/aprobaciones";

import { escaladaPorInvitacion, repoProcesado } from "../api/ayuda";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/sesion", async () => (await import("../api/ayuda")).sesionFalsa);

const AHORA = "2026-10-16T15:00:00-05:00";
const LAURA: Aprobador = { id: "lm", nombre: "Laura Méndez", rol: "CFO", limite_usd: null, principal: true, iniciales: "LM" };

/** TD-001 escalada como si Tecnologías Delta hubiera llegado por un enlace de invitación (R3 + R11). */
async function conInvitado(): Promise<Repositorio> {
  const repo = await repoProcesado();
  await escaladaPorInvitacion(repo);
  return repo;
}

describe("proveedores nuevos por confirmar", () => {
  it("lista a Tecnologías Delta con TD-001, que escaló solo por ser nuevo", async () => {
    const repo = await conInvitado();
    const lista = await proveedoresPorConfirmar(repo);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ nombre: "Tecnologías Delta SpA", facturas: [{ factura_numero: "TD-001", solo_por_ser_nuevo: true, otras_reglas: [] }] });
  });

  it("Sí: lo agrega a la lista y aprueba la factura que escaló solo por eso", async () => {
    const repo = await conInvitado();
    const [g] = await proveedoresPorConfirmar(repo);
    const r = await confiarEnProveedor({ clave: g!.clave, respuesta: "si", aprobador: LAURA }, { repo, ahora: AHORA });
    expect(r).toMatchObject({ respuesta: "si", aprobadas: 1, rechazadas: 0, siguen_pendientes: 0 });
    expect(r.beneficiario).toMatchObject({ nombre: "Tecnologías Delta SpA", cuenta: { ultimos4: "3390" }, canales: { correos: ["ventas@tecnologiasdelta.example"] } });
    expect(r.entradas[0]).toMatchObject({ tipo: "DECISION_HUMANA", decision: "APROBADA_HUMANO", comentario: "Confiar siempre en Tecnologías Delta SpA: se agregó a la lista permitida." });
    expect((await repo.datosComunes()).beneficiarios.some((b) => b.nombre === "Tecnologías Delta SpA")).toBe(true);
    expect(await repo.registro({ tipo: ["CAMBIO_BENEFICIARIOS"] })).toHaveLength(1);
    expect(await proveedoresPorConfirmar(repo)).toEqual([]);
    expect((await obtenerAprobaciones(repo)).pendientes.map((p) => p.factura_numero)).not.toContain("TD-001");
  });

  it("Sí: una factura que además falla otra regla (R9) sigue escalada", async () => {
    const repo = await conInvitado();
    const td = (await repo.registro({ tipo: ["DECISION_AGENTE"] })).findLast((e) => e.factura_numero === "TD-001")!;
    await repo.agregarEntrada({ ...td, id: await repo.siguienteIdRegistro(2026), reglas_que_fallaron: ["R3", "R9", "R11"] });
    const [g] = await proveedoresPorConfirmar(repo);
    expect(g!.facturas[0]).toMatchObject({ solo_por_ser_nuevo: false, otras_reglas: ["R9"] });
    const r = await confiarEnProveedor({ clave: g!.clave, respuesta: "si", aprobador: LAURA }, { repo, ahora: AHORA });
    expect(r).toMatchObject({ aprobadas: 0, siguen_pendientes: 1 });
    expect(r.beneficiario).not.toBeNull();
    expect((await obtenerAprobaciones(repo)).pendientes.map((p) => p.factura_numero)).toContain("TD-001");
  });

  it("No: rechaza sus facturas y no lo agrega", async () => {
    const repo = await conInvitado();
    const [g] = await proveedoresPorConfirmar(repo);
    const r = await confiarEnProveedor({ clave: g!.clave, respuesta: "no", aprobador: LAURA }, { repo, ahora: AHORA });
    expect(r).toMatchObject({ respuesta: "no", beneficiario: null, rechazadas: 1 });
    expect((await repo.datosComunes()).beneficiarios.some((b) => b.nombre === "Tecnologías Delta SpA")).toBe(false);
    expect(await proveedoresPorConfirmar(repo)).toEqual([]);
  });

  it("Sí con un aprobador sin límite suficiente: se agrega, pero la factura sigue pendiente (nunca salta el límite)", async () => {
    const repo = await conInvitado();
    const [g] = await proveedoresPorConfirmar(repo);
    const corto: Aprobador = { id: "u-corto", nombre: "Corto", rol: "Aprobador", limite_usd: 10000, principal: false, iniciales: "CO" };
    const r = await confiarEnProveedor({ clave: g!.clave, respuesta: "si", aprobador: corto, cuentas: [corto] }, { repo, ahora: AHORA });
    expect(r).toMatchObject({ aprobadas: 0, siguen_pendientes: 1 });
    expect((await obtenerAprobaciones(repo)).pendientes.map((p) => p.factura_numero)).toContain("TD-001");
  });
});
