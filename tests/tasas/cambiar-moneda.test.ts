// #86 parte 2: cambiar la moneda base convierte límites con la tasa del día y nunca suma monedas distintas.

import { describe, expect, it } from "vitest";

import { relojFijo } from "@/dominio/reloj";
import type { Aprobador, EntradaRegistro, TablaTasas } from "@/dominio/tipos";
import { crearAlmacenEquipoMemoria } from "@/equipo/memoria";
import { EMPRESA_ID } from "@/equipo/tipos";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import type { Repositorio } from "@/repositorio/repositorio";
import { facturasVigentes } from "@/reglas/libro";
import { cambiarMonedaBase, vistaPreviaMoneda } from "@/servicios/moneda";
import { guardarProveedorParaTest } from "./ayuda-moneda";

const AHORA = "2026-10-17T10:00:00-05:00";
const ADMIN: Aprobador = { id: "u-admin", nombre: "Admin", rol: "Administrador", limite_usd: null, principal: true, iniciales: "AD" };
const USD_COP: TablaTasas = { periodo: "2026-10", base: "USD", tasas: { COP: "4000", MXN: "18.5" } };

/** Repositorio en memoria (escenario de prueba) que responde tasas del día como producción. */
async function conTasas(tabla: TablaTasas = USD_COP): Promise<Repositorio> {
  const repo = await crearRepositorioMemoria("lote-demo-oct", undefined, { lote: "vacio" });
  let actual = tabla;
  return {
    ...repo,
    tasasVigentes: async () => {
      const base = (await repo.empresa()).moneda_base;
      // Tras el cambio, la "fuente" ya responde en la base nueva.
      if (base !== actual.base) actual = { periodo: "2026-10", base, tasas: { USD: "0.00025", MXN: "0.004625" } };
      return { tabla: actual, fecha: "2026-10-17", fuente: "prueba", estado: "hoy" as const };
    },
  };
}

function equipo() {
  const a = crearAlmacenEquipoMemoria(relojFijo(AHORA));
  a.agregarMiembro(EMPRESA_ID, "u-admin", "admin");
  a.agregarMiembro(EMPRESA_ID, "u-andres", "aprobador", 500000);
  return a;
}

describe("cambiar la moneda base (#86)", () => {
  it("vista previa: reglas, proveedores con límite y aprobadores convertidos con la tasa del día, en unidades", async () => {
    const repo = await conTasas();
    await guardarProveedorParaTest(repo, 250000);
    const v = await vistaPreviaMoneda(repo, equipo(), "COP");
    expect(v.tasa).toBe("1 USD = 4.000,00 COP");
    expect(v.reglas[0]).toEqual({ concepto: "Pago automático (R9)", antes: "USD 3.000,00", despues: "COP 12.000.000" });
    expect(v.proveedores).toContainEqual({ concepto: "Proveedor Prueba", antes: "USD 2.500,00", despues: "COP 10.000.000" });
    expect(v.aprobadores).toEqual([{ concepto: expect.any(String), antes: "USD 5.000,00", despues: "COP 20.000.000" }]);
  });

  it("al cambiar: versión nueva en COP, proveedores y aprobadores convertidos, empresa en COP y CAMBIO_EMPRESA en el registro", async () => {
    const repo = await conTasas();
    const eq = equipo();
    await guardarProveedorParaTest(repo, 250000);
    const antes = await repo.reglasVigentes();
    const r = await cambiarMonedaBase(repo, eq, "COP", ADMIN, AHORA);
    const reglas = await repo.reglasVigentes();
    expect(r.version).toBe(antes.version + 1);
    expect(reglas).toMatchObject({ moneda: "COP", limites: { pago_automatico_usd: 1_200_000_000, maximo_absoluto_usd: 6_000_000_000 }, presupuesto: { monto_usd: 24_000_000_000 } });
    expect((await repo.empresa()).moneda_base).toBe("COP");
    expect((await repo.datosComunes()).beneficiarios.find((b) => b.nombre === "Proveedor Prueba")?.limite_mensual_usd).toBe(1_000_000_000);
    expect((await eq.miembros(EMPRESA_ID)).find((m) => m.usuario_id === "u-andres")?.limite_aprobacion_usd).toBe(2_000_000_000);
    expect(r.entrada.explicacion).toContain("cambió la moneda base de USD a COP con la tasa 1 USD = 4.000,00 COP");
  });

  it("sin tasas del día, misma moneda o sin ser administrador: no cambia nada", async () => {
    const sinTasas = await crearRepositorioMemoria("lote-demo-oct", undefined, { lote: "vacio" });
    await expect(cambiarMonedaBase(sinTasas, equipo(), "COP", ADMIN, AHORA)).rejects.toMatchObject({ estado: 409 });
    const repo = await conTasas();
    await expect(cambiarMonedaBase(repo, equipo(), "USD", ADMIN, AHORA)).rejects.toMatchObject({ estado: 400 });
    await expect(cambiarMonedaBase(repo, equipo(), "COP", { ...ADMIN, principal: false }, AHORA)).rejects.toMatchObject({ estado: 403 });
    expect((await repo.empresa()).moneda_base).toBe("USD");
  });

  it("lo ya pagado en USD sigue contando en el presupuesto en COP (nunca suma monedas distintas)", () => {
    const pagada = { id: "REG-1", tipo: "DECISION_AGENTE", decision: "PAGAR", momento: "2026-10-05T10:00:00-05:00", monto_usd_centavos: 100000, beneficiario: "X", factura_numero: "F-1", extraccion: null, sha256: null, ref_interna: "INT-1" } as unknown as EntradaRegistro;
    const enCop = { ...pagada, id: "REG-2", ref_interna: "INT-2", monto_usd_centavos: 400000000, moneda_base: "COP" as const };
    const cop: TablaTasas = { periodo: "2026-10", base: "COP", tasas: { USD: "0.00025" } };
    expect(facturasVigentes([pagada, enCop], cop).map((f) => f.usd_centavos)).toEqual([400000000, 400000000]);
    // Sin tasa para convertir la entrada en USD: lanza (el motor lo atrapa y no paga).
    expect(() => facturasVigentes([pagada], { periodo: "2026-10", base: "COP", tasas: {} })).toThrow();
  });
});
