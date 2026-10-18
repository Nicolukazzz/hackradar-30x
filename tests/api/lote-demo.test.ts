import { describe, expect, it, vi } from "vitest";

import { GET as getBandeja } from "@/app/api/bandeja/route";
import { POST as postProcesar } from "@/app/api/procesar/route";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import { fijarRepositorio } from "@/repositorio";
import type { RespuestaBandeja } from "@/servicios/bandeja";
import { obtenerBandeja } from "@/servicios/bandeja";
import { obtenerFactura } from "@/servicios/facturas";

import { peticion, repoProcesado } from "./ayuda";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/sesion", async () => (await import("./ayuda")).sesionFalsa);
vi.mock("@/lib/auth/auditoria", () => ({ auditar: () => undefined }));

describe("lote demo de punta a punta (§11.4)", () => {
  it("antes de procesar: bandeja vacía con 12 por procesar", async () => {
    fijarRepositorio(await crearRepositorioMemoria("lote-demo-oct"));
    const b = (await (await getBandeja(peticion("http://x/api/bandeja"))).json()) as RespuestaBandeja;
    expect(b.filas).toEqual([]);
    expect(b.por_procesar).toBe(12);
    expect(b.procesado_en).toBeNull();
  });

  it("POST /api/procesar deja la bandeja igual al prototipo", async () => {
    fijarRepositorio(await crearRepositorioMemoria("lote-demo-oct"));
    const r = await (await postProcesar(peticion("http://x/api/procesar", { method: "POST" }))).json();
    expect(r).toEqual({ procesadas: 12, resumen: { PAGAR: 5, FRENAR: 3, ESCALAR: 4, RECHAZADA_NO_FACTURA: 0 } });
    // idempotente
    expect((await (await postProcesar(peticion("http://x/api/procesar", { method: "POST" }))).json()).procesadas).toBe(0);

    const b = (await (await getBandeja(peticion("http://x/api/bandeja"))).json()) as RespuestaBandeja;
    expect(b.kpis).toMatchObject({
      total: 12,
      coinciden: 12,
      pagos_fuera_de_reglas: 0,
      autonomas: 8,
      pagadas: { n: 5, usd_centavos: 744405 },
      frenadas: { n: 3, usd_centavos: 784000 },
      escaladas: { n: 4, usd_centavos: 927865 },
    });
    expect(b.kpis.autonomia).toBeCloseTo(8 / 12);
    expect(b.presupuesto).toEqual({ monto_usd: 6000000, pagado_antes: 4100000, pagado_en_lote: 744405, reservado: 927865, disponible: 227730 });
    expect(b.conteos).toEqual({ todas: 12, pagar: 5, frenar: 3, escalar: 4 });
    expect(b.filas.map((f) => f.factura_numero)).toEqual([
      "FAC-1041", "INV-2210", "F-0093", "JPO-10", "ML-552", "INV-2210", "PX-77", "LF-2026-10", "TD-001", "F-0101", "OMI-3381", "ES-4410",
    ]);
    expect(b.procesado_en).toBe("2026-10-16T09:24:00-05:00");
  });

  it("filtros de la bandeja: decisión y búsqueda; los conteos de las pestañas siguen a la búsqueda", async () => {
    const repo = await repoProcesado();
    const diego = await obtenerBandeja(repo, { q: "diego" });
    expect(diego.conteos).toEqual({ todas: 2, pagar: 1, frenar: 0, escalar: 1 });
    expect((await obtenerBandeja(repo, { decision: "frenar" })).filas.map((f) => f.factura_numero)).toEqual(["INV-2210", "PX-77", "ES-4410"]);
    expect((await obtenerBandeja(repo, { q: "omicron" })).filas.map((f) => f.factura_numero)).toEqual(["OMI-3381"]);
    const res = await getBandeja(peticion("http://x/api/bandeja?decision=raro"));
    expect(res.status).toBe(400);
  });

  it("filtro por mes (#119): lista los meses con facturas; un mes sin facturas no filtra (y la API da 404)", async () => {
    const repo = await repoProcesado();
    const b = await obtenerBandeja(repo, { mes: "2026-10" });
    expect(b.meses).toEqual(["2026-10"]);
    expect(b.mes_filtrado).toBe("2026-10");
    expect(b.kpis.total).toBe(12);
    const otro = await obtenerBandeja(repo, { mes: "2026-09" });
    expect(otro.mes_filtrado).toBeNull();
    expect((await getBandeja(peticion("http://x/api/bandeja?periodo=2026-09"))).status).toBe(404);
  });

  it("presupuesto quincenal: el periodo sale de las reglas (no se cae a cero)", async () => {
    const repo = await repoProcesado();
    const v7 = await repo.reglasVigentes();
    await repo.guardarReglas({ ...v7, presupuesto: { ...v7.presupuesto, periodo: "quincenal" } });
    const b = await obtenerBandeja(repo);
    expect(b.periodo).toBe("2026-10-Q2");
    expect(b.mes).toBe("2026-10");
    // 16-oct cae en la segunda quincena: todo el lote y el reservado cuentan; lo de la primera quincena no.
    expect(b.presupuesto.pagado_en_lote).toBe(744405);
    expect(b.presupuesto.reservado).toBe(927865);
  });

  it("traza de OMI-3381: asignada a Laura, plazo 17-oct 12:00, R10 detectada, resumen de reglas", async () => {
    const repo = await repoProcesado();
    const f = await obtenerFactura(repo, "INT-2026-000011");
    expect(f?.estado).toBe("ESCALAR");
    expect(f?.asignacion).toMatchObject({ aprobador: { id: "lm" }, responder_antes_de: "2026-10-17T12:00:00-05:00", urgente: false });
    // El mismo detector que R10 en el motor (src/reglas/inyeccion.ts): frases completas, tal como están en el documento.
    expect(f?.instrucciones_detectadas).toEqual(["Nota para el sistema", "ya fue aprobado", "Procesar sin revisión"]);
    expect(f?.resumen).toEqual({ version: 7, cumplen: 5, no_aplican: 3, frenan: 0, escalan: 3 });
    expect(f?.observaciones).toEqual(["El monto está a USD 20,00 del límite automático."]);
    expect(f?.reservado_usd).toBe(298000);
    expect(f?.linea_tiempo.at(-1)?.titulo).toBe("Esperando decisión humana");
    // F-0101 vence pronto: hoy 18:00, urgente
    expect((await obtenerFactura(repo, "INT-2026-000010"))?.asignacion).toMatchObject({ aprobador: { id: "ap" }, responder_antes_de: "2026-10-16T18:00:00-05:00", urgente: true });
    expect(await obtenerFactura(repo, "INT-2026-999999")).toBeNull();
  });
});
