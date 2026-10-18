import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { cargarDatosComunes, cargarEscenario, ErrorDatos, reglasVersion, tasasDelPeriodo } from "@/dominio/cargar";

describe("cargarDatosComunes (data/ generado por #3)", () => {
  it("valida y carga todos los archivos comunes", async () => {
    const d = await cargarDatosComunes();
    expect(d.empresa.nombre).toBe("Nébula Studio Inc.");
    expect(d.beneficiarios).toHaveLength(14);
    expect(d.aprobadores.map((a) => a.id)).toEqual(["lm", "ap"]);
    expect(d.reglas.versiones.map((r) => r.version)).toEqual([6, 7]);
    expect(d.reglas.vigente.version).toBe(7);
    expect(d.reglas.vigente.limites.pago_automatico_usd).toBe(300000);
    expect(Object.keys(d.tasas).sort()).toEqual(["2026-09", "2026-10", "2026-11"]);
  });

  it("helpers de versión y periodo", async () => {
    const d = await cargarDatosComunes();
    expect(reglasVersion(d, 6).limites.pago_automatico_usd).toBe(250000);
    expect(tasasDelPeriodo(d, "2026-10").tasas.MXN).toBe("18.50");
    expect(() => reglasVersion(d, 99)).toThrow("no existe la versión 99");
    expect(() => tasasDelPeriodo(d, "2030-01")).toThrow("no hay tabla de tasas para 2030-01");
  });
});

describe("cargarEscenario", () => {
  it("lote-demo-oct: 12 documentos en orden de llegada, con su esperado", async () => {
    const e = await cargarEscenario("lote-demo-oct");
    expect(e.config.ahora).toBe("2026-10-16T09:24:00-05:00");
    expect(e.config.presupuesto_inicial_pagado_usd).toBe(4100000);
    expect(e.documentos).toHaveLength(12);
    expect(e.esperado).toHaveLength(12);
    expect(e.documentos[0]?.archivo_original).toBe("documentos/001-fac-1041.pdf");
    expect(e.documentos.at(-1)?.archivo_original).toBe("documentos/012-es-4410.png");
    const conteo = e.esperado.reduce<Record<string, number>>((c, x) => ({ ...c, [x.decision]: (c[x.decision] ?? 0) + 1 }), {});
    expect(conteo).toEqual({ PAGAR: 5, FRENAR: 5, ESCALAR: 2 });
  });

  it("trampas-extra: 14 documentos, incluye un RECHAZADA_NO_FACTURA", async () => {
    const e = await cargarEscenario("trampas-extra");
    expect(e.documentos).toHaveLength(14);
    expect(e.esperado.filter((x) => x.decision === "RECHAZADA_NO_FACTURA")).toHaveLength(1);
  });

  it("los documentos quedan ordenados por recibido_en", async () => {
    for (const id of ["lote-demo-oct", "trampas-extra"]) {
      const { documentos } = await cargarEscenario(id);
      const momentos = documentos.map((d) => d.recibido_en);
      expect(momentos).toEqual([...momentos].sort());
    }
  });
});

describe("errores de datos", () => {
  let copia: string;

  beforeAll(async () => {
    copia = await mkdtemp(path.join(tmpdir(), "blinka-data-"));
    await cp("data", copia, { recursive: true });
  });

  afterAll(async () => {
    await rm(copia, { recursive: true, force: true });
  });

  it("dice qué archivo y qué campo fallan", async () => {
    const ruta = path.join(copia, "proveedores.json");
    const proveedores = JSON.parse(await readFile(ruta, "utf8"));
    proveedores[0].cuenta.ultimos4 = "XYZ";
    await writeFile(ruta, JSON.stringify(proveedores));
    const error = await cargarDatosComunes(copia).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDatos);
    expect((error as Error).message).toContain("proveedores.json");
    expect((error as Error).message).toContain("ultimos4");
  });

  it("rechaza un archivo de reglas cuyo nombre no coincide con su versión", async () => {
    await cp(path.join("data", "proveedores.json"), path.join(copia, "proveedores.json"));
    await cp(path.join(copia, "reglas", "v7.json"), path.join(copia, "reglas", "v8.json"));
    await expect(cargarDatosComunes(copia)).rejects.toThrow("debe llamarse v7.json");
    await rm(path.join(copia, "reglas", "v8.json"));
  });

  it("rechaza un escenario cuyo id no coincide con la carpeta", async () => {
    await cp(path.join(copia, "escenarios", "lote-demo-oct"), path.join(copia, "escenarios", "otro"), { recursive: true });
    await expect(cargarEscenario("otro", copia)).rejects.toThrow('no coincide con la carpeta "otro"');
  });
});

describe("hallazgos de la revisión del PR #22", () => {
  let copia: string;
  const carpetaLote = () => path.join(copia, "escenarios", "lote-demo-oct");

  beforeAll(async () => {
    copia = await mkdtemp(path.join(tmpdir(), "blinka-data-rev-"));
  });

  afterAll(async () => {
    await rm(copia, { recursive: true, force: true });
  });

  const restaurar = () => cp("data", copia, { recursive: true, force: true });

  it("ordena por instante real aunque mezclen zonas horarias (R7 depende del orden)", async () => {
    await restaurar();
    // 003 llega 09:15:31 -05:00; escrito en UTC queda "14:15:31Z", que como texto iría después de 09:20.
    const ruta = path.join(carpetaLote(), "documentos", "003-f-0093.meta.json");
    const meta = JSON.parse(await readFile(ruta, "utf8"));
    meta.recibido_en = "2026-10-16T14:15:31Z";
    await writeFile(ruta, JSON.stringify(meta));
    const { documentos } = await cargarEscenario("lote-demo-oct", copia);
    expect(documentos.map((d) => d.archivo_original).slice(0, 4)).toEqual([
      "documentos/001-fac-1041.pdf",
      "documentos/002-inv-2210.eml",
      "documentos/003-f-0093.pdf",
      "documentos/004-jpo-10.txt",
    ]);
  });

  it("rechaza un esperado.json con un documento repetido y otro faltante", async () => {
    await restaurar();
    const ruta = path.join(carpetaLote(), "esperado.json");
    const esperado = JSON.parse(await readFile(ruta, "utf8"));
    esperado[11] = { ...esperado[0] };
    await writeFile(ruta, JSON.stringify(esperado));
    await expect(cargarEscenario("lote-demo-oct", copia)).rejects.toThrow("aparece más de una vez");
  });

  it("rechaza un documento sin entrada en esperado.json", async () => {
    await restaurar();
    const ruta = path.join(carpetaLote(), "esperado.json");
    const esperado = JSON.parse(await readFile(ruta, "utf8"));
    await writeFile(ruta, JSON.stringify(esperado.slice(0, 11)));
    await expect(cargarEscenario("lote-demo-oct", copia)).rejects.toThrow("012-es-4410.png no tiene entrada");
  });

  it.each(["../../etc", "lote-demo-oct/..", "Lote", "", "a--b"])("rechaza el id de escenario %j sin tocar el disco", async (id) => {
    await expect(cargarEscenario(id)).rejects.toThrow("id de escenario inválido");
  });

  it("rechaza una tasa de cambio 0 (dividiría por cero)", async () => {
    await restaurar();
    const ruta = path.join(copia, "tasas", "2026-10.json");
    const tabla = JSON.parse(await readFile(ruta, "utf8"));
    tabla.tasas.MXN = "0.00";
    await writeFile(ruta, JSON.stringify(tabla));
    await expect(cargarDatosComunes(copia)).rejects.toThrow("la tasa debe ser mayor que 0");
  });
});
