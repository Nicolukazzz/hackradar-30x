import { describe, expect, it, vi } from "vitest";

import { GET as exportCsv } from "@/app/api/registro/export.csv/route";
import { GET as getRegistro } from "@/app/api/registro/route";
import { POST as postReglas } from "@/app/api/reglas/route";
import { POST as postSimular } from "@/app/api/reglas/simular/route";
import { decidir } from "@/aprobaciones/decidir";
import type { Reglas } from "@/dominio/tipos";
import { COLUMNAS_CSV, registroACsv } from "@/servicios/registro";
import { obtenerReglas, simularReglas } from "@/servicios/reglas";

import { comoCuenta, entradaDe, peticion, repoProcesado } from "./ayuda";


vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/sesion", async () => (await import("./ayuda")).sesionFalsa);
vi.mock("@/lib/auth/auditoria", () => ({ auditar: () => undefined }));

const conAutomatico = (r: Reglas, usd: number): Reglas => ({ ...r, limites: { ...r.limites, pago_automatico_usd: usd } });
const json = (url: string, body: unknown) => peticion(url, { method: "POST", body: JSON.stringify(body) });

describe("reglas: simular y guardar (§13.4, §14)", () => {
  it("v7 sobre el lote demo: 12/12, 0 pagos fuera de reglas, autonomía 10/12", async () => {
    const repo = await repoProcesado();
    const r = await simularReglas(repo, await repo.reglasVigentes());
    expect(r).toMatchObject({ total: 12, coinciden: 12, pagos_indebidos: 0, autonomas: 10, escalados_innecesarios: 0, reglas_correctas: 12 });
  });

  it("bajar el límite automático a USD 2.000 cambia la simulación (F-0093 escala) sin pagos indebidos", async () => {
    const repo = await repoProcesado();
    const r = await (await postSimular(json("http://x/api/reglas/simular", conAutomatico(await repo.reglasVigentes(), 200000)))).json();
    expect(r.pagos_indebidos).toBe(0);
    expect(r.coinciden).toBeLessThan(12);
    expect(r.documentos.find((d: { factura_numero: string }) => d.factura_numero === "F-0093")).toMatchObject({ esperado: "PAGAR", obtenido: "ESCALAR" });
  });

  it("subir el límite automático a USD 5.000 paga LF-2026-10 → pagos fuera de reglas → no se guarda (409)", async () => {
    const repo = await repoProcesado();
    const v7 = await repo.reglasVigentes();
    const res = await postReglas(json("http://x/api/reglas", conAutomatico(v7, 500000)));
    expect(res.status).toBe(409);
    expect((await res.json()).reporte.pagos_indebidos).toBeGreaterThan(0);
    expect((await repo.reglasVigentes()).version).toBe(7);
  });

  it("guardar como v8: un admin (#51), con su nombre; escribe CAMBIO_REGLAS; R9 > R6 → 400", async () => {
    const repo = await repoProcesado();
    const v7 = await repo.reglasVigentes();
    expect((await postReglas(json("http://x/api/reglas", conAutomatico(v7, 2000000)))).status).toBe(400);
    const res = await postReglas(json("http://x/api/reglas", conAutomatico(v7, 200000)));
    expect(res.status).toBe(201);
    expect((await res.json()).version).toBe(8);
    const v8 = await repo.reglasVigentes();
    expect(v8).toMatchObject({ version: 8, editada_por: "Ana Torres (ana@nebula.example)", limites: { pago_automatico_usd: 200000 } });
    expect((await obtenerReglas(repo)).historial.map((h) => h.version)).toEqual([8, 7, 6]);
    expect(await repo.registro({ tipo: ["CAMBIO_REGLAS"] })).toHaveLength(1);
  });

  it("#51: aprobador y tesorería no guardan reglas (403); la versión vigente no cambia", async () => {
    const repo = await repoProcesado();
    const v7 = await repo.reglasVigentes();
    for (const rol of ["aprobador", "tesoreria"] as const) {
      comoCuenta(`Persona ${rol}`, rol);
      const res = await postReglas(json("http://x/api/reglas", conAutomatico(v7, 200000)));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe("Solo un administrador puede cambiar las reglas de pago.");
    }
    // simular sí puede cualquiera del equipo: no guarda nada
    expect((await postSimular(json("http://x/api/reglas/simular", conAutomatico(v7, 200000)))).status).toBe(200);
    expect((await repo.reglasVigentes()).version).toBe(7);
    expect(await repo.registro({ tipo: ["CAMBIO_REGLAS"] })).toHaveLength(0);
  });

  it("GET /api/reglas: uso de tasas en el lote", async () => {
    const repo = await repoProcesado();
    const r = await obtenerReglas(repo);
    expect(r.uso_tasas.find((t) => t.moneda === "MXN")).toEqual({ moneda: "MXN", tasa: "18.50", facturas: 3 });
    expect(r.beneficiarios).toHaveLength(14);
  });
});

describe("registro (§9, §13.5)", () => {
  it("agrupado por día, más nuevo primero; nunca se achica; filtro de decisiones humanas", async () => {
    const repo = await repoProcesado();
    const largo = (await repo.registro()).length;
    const lf = await entradaDe(repo, "LF-2026-10");
    await decidir({ ref: lf.ref_interna, accion: "aprobar", comentario: "Hito final entregado.", aprobador_id: "lm" }, { repo, ahora: "2026-10-16T15:10:00-05:00" });
    const r = await (await getRegistro(peticion("http://x/api/registro"))).json();
    expect(r.total).toBe(largo + 1);
    expect(r.dias[0].fecha).toBe("2026-10-16");
    expect(r.dias[0].entradas[0]).toMatchObject({ tipo: "DECISION_HUMANA", factura_numero: "LF-2026-10" });
    const humanas = await (await getRegistro(peticion("http://x/api/registro?decision=humanas"))).json();
    expect(humanas.dias.flatMap((d: { entradas: unknown[] }) => d.entradas).every((e: { tipo: string }) => e.tipo === "DECISION_HUMANA")).toBe(true);
    // la interfaz no tiene update ni delete; agregar una entrada con id repetido falla
    await expect(repo.agregarEntrada({ ...lf })).rejects.toThrow("no se sobrescribe");
    expect(await repo.registro()).toHaveLength(largo + 1);
  });

  it("buscar por regla (q=R4) y «Pagadas» incluye lo aprobado por una persona", async () => {
    const repo = await repoProcesado();
    const entradas = (r: { dias: { entradas: { factura_numero: string | null; decision: string | null }[] }[] }) => r.dias.flatMap((d) => d.entradas);
    const r4 = await (await getRegistro(peticion("http://x/api/registro?q=R4"))).json();
    expect(entradas(r4).map((e) => e.factura_numero)).toContain("F-0101");
    const lf = await entradaDe(repo, "LF-2026-10");
    await decidir({ ref: lf.ref_interna, accion: "aprobar", comentario: "Hito final entregado.", aprobador_id: "lm" }, { repo, ahora: "2026-10-16T15:10:00-05:00" });
    const pagadas = entradas(await (await getRegistro(peticion("http://x/api/registro?decision=pagar"))).json());
    expect(pagadas.some((e) => e.decision === "APROBADA_HUMANO" && e.factura_numero === "LF-2026-10")).toBe(true);
    expect(pagadas.every((e) => e.decision === "PAGAR" || e.decision === "APROBADA_HUMANO")).toBe(true);
  });

  it("export.csv: 15 columnas de §9, BOM, sin inyección de fórmulas", async () => {
    await repoProcesado();
    const bytes = new Uint8Array(await (await exportCsv(peticion("http://x/api/registro/export.csv"))).arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const [cabecera] = new TextDecoder().decode(bytes).split("\r\n");
    expect(cabecera?.split(",")).toEqual([...COLUMNAS_CSV]);
    expect(COLUMNAS_CSV).toHaveLength(15);
  });

  it("CSV: una explicación que empieza con = no se vuelve fórmula; comas y comillas escapadas", async () => {
    const repo = await repoProcesado();
    const e = await entradaDe(repo, "OMI-3381");
    const csv = registroACsv([{ ...e, explicacion: '=HYPERLINK("http://malo")', comentario: 'dijo "sí", luego no' }]);
    const fila = csv.split("\r\n")[1] ?? "";
    expect(fila).toContain(`"'=HYPERLINK(""http://malo"")"`);
    expect(fila).toContain(`"dijo ""sí"", luego no"`);
  });
});
