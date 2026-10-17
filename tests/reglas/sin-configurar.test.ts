// #106: producción arranca sin reglas. Con la versión 0 ninguna factura se paga ni se frena sola.

import { describe, expect, it } from "vitest";

import type { Repositorio } from "@/repositorio/repositorio";
import { procesarLote } from "@/reglas/motor";
import { EXPLICACION_SIN_REGLAS } from "@/reglas/explicar";
import { reglasSinConfigurar, sinConfigurar } from "@/reglas/sin-configurar";
import { simularReglas } from "@/servicios/reglas";

import { cargarGolden } from "./escenario";

describe("reglas sin configurar (#106)", () => {
  it("los dos escenarios completos: todo escala (o se rechaza si no es factura), nada se paga ni se frena", async () => {
    for (const id of ["lote-demo-oct", "trampas-extra"]) {
      const g = await cargarGolden(id);
      const l = procesarLote(g.docs, { datos: g.datos, reglas: reglasSinConfigurar(), historial: g.escenario.historial, ahora: g.escenario.config.ahora });
      for (const r of l.resultados) {
        expect(["ESCALAR", "RECHAZADA_NO_FACTURA"]).toContain(r.decision);
        if (r.decision === "ESCALAR") {
          expect(r.explicacion).toBe(EXPLICACION_SIN_REGLAS);
          expect(r.evaluaciones).toHaveLength(11); // la traza igual muestra cada regla
        }
      }
      expect(l.entradas.every((e) => e.reglas_version === 0)).toBe(true);
    }
  });

  it("simular la versión 0 sin escenario cargado usa el set de prueba de data/ como la versión 1", async () => {
    const sinEscenario = { escenario: async () => null } as unknown as Repositorio;
    const r = await simularReglas(sinEscenario, reglasSinConfigurar());
    expect(r).toMatchObject({ total: 12, pagos_indebidos: 0 });
    expect(r.autonomas).toBeGreaterThan(0);
    expect(sinConfigurar({ version: 1 })).toBe(false);
  });
});
