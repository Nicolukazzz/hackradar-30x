// #86: lo decidido antes de cambiar la moneda base se muestra, se suma y se compara con límites en la base de hoy.
// Caso real (2026-10-18): ES-001 decidida en USD se veía «USD 224,42» en una empresa ya en BRL, y el reservado sumaba
// USD con BRL. Además, al aprobar, el límite (ya en la base nueva) se comparaba con el monto en USD.

import { describe, expect, it, vi } from "vitest";

import { decidir } from "@/aprobaciones/decidir";
import { relojFijo } from "@/dominio/reloj";
import type { Aprobador, TablaTasas } from "@/dominio/tipos";
import { crearAlmacenEquipoMemoria } from "@/equipo/memoria";
import { EMPRESA_ID } from "@/equipo/tipos";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import type { Repositorio } from "@/repositorio/repositorio";
import { montoEnBase } from "@/reglas/en-base";
import { obtenerAprobaciones } from "@/servicios/aprobaciones";
import { obtenerBandeja } from "@/servicios/bandeja";
import { procesarPendientes } from "@/servicios/lote";
import { cambiarMonedaBase } from "@/servicios/moneda";

vi.mock("server-only", () => ({}));

const AHORA = "2026-10-17T10:00:00-05:00";
const ADMIN: Aprobador = { id: "u-admin", nombre: "Admin", rol: "Administrador", limite_usd: null, principal: true, iniciales: "AD" };

/** Lote demo decidido en USD; después la empresa pasa a COP (1 USD = 4.000 COP). */
async function loteYCambioACop(): Promise<Repositorio> {
  const base = await crearRepositorioMemoria("lote-demo-oct");
  await procesarPendientes(base);
  const repo: Repositorio = {
    ...base,
    tasasVigentes: async () => {
      const moneda = (await base.empresa()).moneda_base;
      const tabla: TablaTasas = moneda === "USD" ? { periodo: "2026-10", base: "USD", tasas: { COP: "4000" } } : { periodo: "2026-10", base: "COP", tasas: { USD: "0.00025" } };
      return { tabla, fecha: "2026-10-17", fuente: "prueba", estado: "hoy" as const };
    },
  };
  const eq = crearAlmacenEquipoMemoria(relojFijo(AHORA));
  eq.agregarMiembro(EMPRESA_ID, "u-admin", "admin");
  await cambiarMonedaBase(repo, eq, "COP", ADMIN, AHORA);
  return repo;
}

describe("montos en la moneda base de hoy (#86)", () => {
  it("con la tabla en la base nueva o en la vieja", () => {
    const e = { monto_usd_centavos: 22442, moneda_base: "USD" as const };
    expect(montoEnBase(e, "COP", { periodo: "x", base: "COP", tasas: { USD: "0.00025" } })).toBe(89768000);
    expect(montoEnBase(e, "COP", { periodo: "x", base: "USD", tasas: { COP: "4000" } })).toBe(89768000);
    expect(montoEnBase(e, "COP", { periodo: "x", base: "BRL", tasas: {} })).toBeNull();
  });

  it("Pendientes y Bandeja muestran y suman en COP lo decidido en USD", async () => {
    const repo = await loteYCambioACop();
    const a = await obtenerAprobaciones(repo);
    expect(a.moneda_base).toBe("COP");
    expect(a.pendientes.every((p) => p.moneda_base === "COP")).toBe(true);
    const lf = a.pendientes.find((p) => p.factura_numero === "LF-2026-10")!;
    expect(lf.monto_usd_centavos).toBe(450000 * 4000);
    expect(a.reservado_usd).toBe(a.pendientes.reduce((s, p) => s + (p.monto_usd_centavos ?? 0), 0));
    expect(a.reservado_usd % 4000).toBe(0);
    const b = await obtenerBandeja(repo);
    expect(b.kpis.pagadas.usd_centavos).toBe(744405 * 4000);
    expect(b.filas.every((f) => f.moneda_base === "COP" || f.monto_usd_centavos === null)).toBe(true);
  });

  it("al aprobar, el límite (en COP) se compara con el monto convertido: no deja pasar lo que lo supera", async () => {
    const repo = await loteYCambioACop();
    const lf = (await repo.registro({ tipo: ["DECISION_AGENTE"] })).findLast((e) => e.factura_numero === "LF-2026-10")!;
    // USD 4.500 = COP 18.000.000. Un aprobador con límite COP 10.000.000 no puede (antes comparaba 450.000 ≤ 1.000.000.000).
    const limitado: Aprobador = { id: "u-andres", nombre: "Andrés", rol: "Aprobador", limite_usd: 1_000_000_000, principal: false, iniciales: "AN" };
    await expect(
      decidir({ ref: lf.ref_interna, accion: "aprobar", comentario: "Hito final revisado", aprobador_id: "u-andres", cuentas: [limitado] }, { repo, ahora: AHORA }),
    ).rejects.toMatchObject({ estado: 403, message: expect.stringContaining("COP 10.000.000,00") });
    const ok = await decidir({ ref: lf.ref_interna, accion: "aprobar", comentario: "Hito final revisado", aprobador_id: "u-admin", cuentas: [ADMIN] }, { repo, ahora: AHORA });
    expect(ok.entrada).toMatchObject({ decision: "APROBADA_HUMANO", monto_usd_centavos: 1_800_000_000, moneda_base: "COP" });
  });
});
