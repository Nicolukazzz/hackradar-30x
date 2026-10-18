// #86: la conversión usa la tasa de la fecha de emisión de la factura (NIC 21), con fotos diarias guardadas.

import { beforeAll, describe, expect, it } from "vitest";

import { type DatosComunes, reglasVersion } from "@/dominio/cargar";
import type { TablaTasas } from "@/dominio/tipos";
import { evaluarFactura, tasasDeLaFactura } from "@/reglas/motor";
import { crearFuenteHistorica } from "@/tasas/fuente-historica";
import { almacenTasasMemoria, asegurarFoto, tablasPorFecha } from "@/tasas/servicio";

import { AHORA, campo, ctx, datosComunes } from "../reglas/fixtures";

const tabla = (fecha: string, mxn: string): TablaTasas => ({ periodo: fecha, base: "USD", tasas: { MXN: mxn } });
const diarias = { "2026-10-01": tabla("2026-10-01", "17.00"), "2026-10-09": tabla("2026-10-09", "18.00"), "2026-10-16": tabla("2026-10-16", "20.00") };

let d: DatosComunes;
beforeAll(async () => {
  d = await datosComunes();
});

describe("tasa de la fecha de emisión (#86)", () => {
  const conEmision = (fecha: string | null, confianza = 0.99) => ({ ...ctx(d).ext, fecha_emision: campo(fecha, confianza) });

  it("usa la foto de la fecha de emisión, o la anterior más cercana", () => {
    const datos = { ...d, tasas_diarias: diarias };
    const r = reglasVersion(d, 7);
    expect(tasasDeLaFactura(datos, r, AHORA, conEmision("2026-10-09")).fecha).toBe("2026-10-09");
    expect(tasasDeLaFactura(datos, r, AHORA, conEmision("2026-10-12")).fecha).toBe("2026-10-09");
    // Emitida antes de la primera foto: la más reciente hasta hoy.
    expect(tasasDeLaFactura(datos, r, AHORA, conEmision("2026-09-20")).fecha).toBe("2026-10-16");
  });

  it("fecha de emisión no confiable (falta, baja confianza o futura): la de hoy; sin fotos diarias (dataset): la del periodo", () => {
    const datos = { ...d, tasas_diarias: diarias };
    const r = reglasVersion(d, 7);
    expect(tasasDeLaFactura(datos, r, AHORA, conEmision(null)).fecha).toBe("2026-10-16");
    expect(tasasDeLaFactura(datos, r, AHORA, conEmision("2026-10-01", 0.5)).fecha).toBe("2026-10-16");
    expect(tasasDeLaFactura(datos, r, AHORA, conEmision("2026-12-01")).fecha).toBe("2026-10-16");
    expect(tasasDeLaFactura(d, r, AHORA, conEmision("2026-10-09"))).toMatchObject({ fecha: null, tabla: { periodo: "2026-10" } });
  });

  it("el monto se convierte con la tasa de emisión y la decisión guarda la fecha de la tasa", () => {
    const c = ctx(d, { ext: { beneficiario_nombre: campo("Diego Herrera"), monto_total: campo({ centavos: 3600000, moneda: "MXN" }), fecha_emision: campo("2026-10-09") } });
    const r = evaluarFactura({ doc: c.doc, ext: c.ext, datos: { ...d, tasas_diarias: diarias }, reglas: c.reglas, historial: [], presupuesto: c.presupuesto, ahora: AHORA });
    expect(r.monto_usd_centavos).toBe(200000); // MXN 36.000 / 18,00 = USD 2.000,00 (con la de hoy, 20,00, serían 1.800)
    expect(r).toMatchObject({ tasa_usada: "MXN 18,00", tasa_fecha: "2026-10-09" });
  });

  it("asegurarFoto pide a la fuente histórica la fecha que falta y la guarda; si falla, no lanza", async () => {
    const almacen = almacenTasasMemoria();
    const f = (async (url: string) =>
      url.includes("2026-10-09") ? new Response(JSON.stringify({ date: "2026-10-09", usd: { mxn: 18.41268018, cop: 3192.19787455, usd: 1 } })) : new Response("", { status: 404 })) as unknown as typeof fetch;
    const historica = crearFuenteHistorica(f);
    await asegurarFoto("USD", "2026-10-09", { almacen, historica });
    expect(tablasPorFecha(await almacen.todas("USD"))["2026-10-09"]).toEqual({ periodo: "2026-10-09", base: "USD", tasas: { MXN: "18.41268018", COP: "3192.19787455" } });
    const errores: unknown[] = [];
    await asegurarFoto("USD", "2026-10-02", { almacen, historica, alFallar: (e) => errores.push(e) });
    expect(errores).toHaveLength(1);
    expect(await almacen.todas("USD")).toHaveLength(1);
  });
});
