// #129: aprobar aunque el agente no esté seguro del total, con el monto que ve o corrige la persona; correcciones en el
// registro; el monto aprobado es el que cuenta en el presupuesto.

import { describe, expect, it } from "vitest";

import { aplicarCorrecciones, resumenCorrecciones } from "@/aprobaciones/correcciones";
import { decidir } from "@/aprobaciones/decidir";
import { formatear } from "@/dominio/dinero";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import type { Repositorio } from "@/repositorio/repositorio";
import { facturasVigentes } from "@/reglas/libro";
import { procesarPendientes } from "@/servicios/lote";

const AHORA = "2026-11-16T11:00:00-05:00";

async function repoTrampas(): Promise<Repositorio> {
  const repo = await crearRepositorioMemoria("trampas-extra");
  await procesarPendientes(repo);
  return repo;
}

async function agente(repo: Repositorio, numero: string) {
  const e = (await repo.registro({ tipo: ["DECISION_AGENTE"] })).find((x) => x.factura_numero === numero);
  if (!e) throw new Error(`sin ${numero}`);
  return e;
}

const aprobar = (repo: Repositorio, ref: string, extra: Record<string, unknown> = {}) =>
  decidir({ ref, accion: "aprobar", comentario: "Revisado con el proveedor", aprobador_id: "lm", ...extra }, { repo, ahora: AHORA });

describe("aprobar con un total dudoso (#129)", () => {
  it("ML-571: la suma no cuadra (R1) y no hay monto confiable; la persona aprueba igual con el total que ve", async () => {
    const repo = await repoTrampas();
    const e = await agente(repo, "ML-571");
    expect(e.decision).toBe("ESCALAR");
    expect(e.monto_usd_centavos).toBeNull();
    const r = await aprobar(repo, e.ref_interna);
    expect(r.entrada.decision).toBe("APROBADA_HUMANO");
    // COP 5.350.000 / 4.200 = USD 1.273,81
    expect(r.entrada.monto_usd_centavos).toBe(127381);
    expect(r.entrada.monto_original).toEqual({ centavos: 535000000, moneda: "COP" });
    expect(r.entrada.explicacion).toContain("no estaba seguro del total");
    // El presupuesto cuenta lo aprobado (antes contaba 0).
    const pagada = facturasVigentes(await repo.registro()).find((f) => f.id === e.id);
    expect(pagada).toMatchObject({ estado: "pagada", usd_centavos: 127381 });
  });

  it("RV-1188: total ilegible; sin corregirlo no se aprueba, con el total corregido sí y queda en el registro", async () => {
    const repo = await repoTrampas();
    const e = await agente(repo, "RV-1188");
    await expect(aprobar(repo, e.ref_interna)).rejects.toMatchObject({ estado: 409 });
    const r = await aprobar(repo, e.ref_interna, { correcciones: { monto_total: { centavos: 1100000, moneda: "BRL" } } });
    expect(r.entrada.decision).toBe("APROBADA_HUMANO");
    expect(r.entrada.monto_usd_centavos).toBe(200000); // BRL 11.000 / 5,50
    expect(r.entrada.extraccion?.monto_total).toEqual({ valor: { centavos: 1100000, moneda: "BRL" }, confianza: 1, fuente: "humano" });
    expect(r.entrada.explicacion).toContain("Datos corregidos: total sin dato → BRL 11.000,00");
    expect(r.entrada.explicacion).not.toContain("no estaba seguro");
  });

  it("el monto corregido cuenta para el límite de quien aprueba (Andrés, hasta USD 5.000)", async () => {
    const repo = await repoTrampas();
    const e = await agente(repo, "RV-1188");
    await expect(
      decidir(
        { ref: e.ref_interna, accion: "aprobar", comentario: "Revisado con el proveedor", aprobador_id: "ap", correcciones: { monto_total: { centavos: 2520000000, moneda: "COP" } } }, // USD 6.000
        { repo, ahora: AHORA },
      ),
    ).rejects.toMatchObject({ estado: 403 });
  });

  it("un total con confianza alta no cambia: se aprueba con el monto del agente y sin nota", async () => {
    const repo = await crearRepositorioMemoria("lote-demo-oct");
    await procesarPendientes(repo);
    const e = await agente(repo, "LF-2026-10");
    const r = await decidir({ ref: e.ref_interna, accion: "aprobar", comentario: "Hito final entregado", aprobador_id: "lm" }, { repo, ahora: "2026-10-16T15:00:00-05:00" });
    expect(r.entrada.monto_usd_centavos).toBe(450000);
    expect(r.entrada.extraccion).toBeNull();
    expect(r.entrada.explicacion).not.toContain("Datos corregidos");
  });

  it("rechazar también guarda las correcciones; una corrección sin cambio real no se anota", async () => {
    const repo = await repoTrampas();
    const e = await agente(repo, "ML-571");
    const r = await decidir(
      { ref: e.ref_interna, accion: "rechazar", comentario: "No reconocemos el monto", aprobador_id: "lm", correcciones: { numero: "ML-571", cuenta_destino_ultimos4: "0000" } },
      { repo, ahora: AHORA },
    );
    expect(r.entrada.decision).toBe("RECHAZADA_HUMANO");
    expect(r.entrada.explicacion).toContain("cuenta 1907 → 0000");
    expect(r.entrada.explicacion).not.toContain("número");
  });
});

describe("correcciones (puras)", () => {
  it("aplicar deja fuente humano y confianza 1; sin correcciones devuelve lo mismo", async () => {
    const repo = await repoTrampas();
    const ext = (await agente(repo, "ML-571")).extraccion!;
    expect(aplicarCorrecciones(ext, {})).toBe(ext);
    const c = aplicarCorrecciones(ext, { fecha_emision: "2026-11-01" });
    expect(c.fecha_emision).toEqual({ valor: "2026-11-01", confianza: 1, fuente: "humano" });
    expect(ext.fecha_emision.fuente).not.toBe("humano");
    expect(resumenCorrecciones(ext, { fecha_emision: "2026-11-01" }, formatear)).toMatch(/^fecha de emisión .* → 2026-11-01$/);
  });
});
