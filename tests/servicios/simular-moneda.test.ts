// Simular reglas en otra moneda base (#149): el set de prueba está en USD, así que los límites se pasan a USD con la
// tasa del día. Antes, con base BRL, el motor escalaba todo y la simulación decía «2/12 correctas, 0 % decide solo».

import { describe, expect, it } from "vitest";

import { cargarDatosComunes } from "@/dominio/cargar";
import { convertirReglas } from "@/dominio/dinero";
import type { Reglas } from "@/dominio/tipos";
import type { Repositorio } from "@/repositorio/repositorio";
import { simularReglas } from "@/servicios/reglas";

/** 1 USD = 5 BRL: 1 BRL = 0,2 USD. */
const TASA_BRL_USD = "0.2";

function produccion(tasas: { base: string; tasas: Record<string, string> } | null): Repositorio {
  return { escenario: async () => null, tasasVigentes: async () => (tasas ? { tabla: tasas } : null) } as unknown as Repositorio;
}

async function reglasEnBrl(): Promise<Reglas> {
  const usd = (await cargarDatosComunes()).reglas.vigente;
  return convertirReglas(usd, "BRL", "5");
}

describe("simular con moneda base distinta de USD (#149)", () => {
  it("con la tasa del día da lo mismo que las reglas en USD", async () => {
    const usd = await simularReglas(produccion(null), (await cargarDatosComunes()).reglas.vigente);
    const brl = await simularReglas(produccion({ base: "BRL", tasas: { USD: TASA_BRL_USD } }), await reglasEnBrl());
    expect(brl).toMatchObject({ pagos_indebidos: 0, coinciden: usd.coinciden, autonomas: usd.autonomas });
    expect(brl.coinciden).toBe(12);
  });

  it("sin tasa del día simula tal cual: escala todo y nunca paga", async () => {
    const r = await simularReglas(produccion(null), await reglasEnBrl());
    expect(r.pagos_indebidos).toBe(0);
    expect(r.documentos.every((d) => d.obtenido !== "PAGAR")).toBe(true);
  });
});
