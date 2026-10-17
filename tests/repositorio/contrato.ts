// Contrato del Repositorio (#17, #44): la misma secuencia corre contra memoria (siempre) y Supabase (si hay).
// Es un recorrido ordenado y no tests sueltos: el registro de Supabase es append-only de verdad y no se
// puede vaciar entre tests; la base se reinicia una vez antes (`npm run test:supabase`).

import { readFile } from "node:fs/promises";

import { expect, it } from "vitest";

import type { EntradaRegistro } from "@/dominio/tipos";
import { ingerir } from "@/ingesta/ingerir";
import { extractorGolden } from "@/ingesta/cargar-escenario";
import { procesarDocumento } from "@/ingesta/pipeline";
import type { Repositorio } from "@/repositorio/repositorio";
import { procesarPendientes } from "@/servicios/lote";

const AHORA = "2026-10-16T10:00:00-05:00";

export function contratoRepositorio(crear: () => Promise<Repositorio>, opciones: { persistente: boolean }) {
  let repo: Repositorio;
  let historial = 0;

  it("arranca con el historial del escenario, sus 12 documentos pendientes y las reglas v6 y v7", async () => {
    repo = await crear();
    const esc = await repo.escenario();
    historial = esc!.entradas_importadas;
    expect(await repo.registro()).toHaveLength(historial);
    expect(await repo.pendientes()).toHaveLength(12);
    expect((await repo.reglasVigentes()).version).toBe(7);
    expect((await repo.historialReglas()).map((h) => h.version)).toEqual([7, 6]);
  });

  it("procesar el lote: 12 decisiones, sin pendientes, y el archivo original del escenario se puede leer", async () => {
    const r = await procesarPendientes(repo);
    expect(r).toEqual({ procesadas: 12, resumen: { PAGAR: 5, FRENAR: 3, ESCALAR: 4, RECHAZADA_NO_FACTURA: 0 } });
    expect(await repo.pendientes()).toHaveLength(0);
    expect(await repo.registro({ tipo: ["DECISION_AGENTE"], ref_interna: "INT-2026-000011" })).toHaveLength(1);
    expect((await repo.leerArchivo("INT-2026-000001"))?.mime).toBe("application/pdf");
    expect((await repo.leerAdjunto("INT-2026-000002", 0))?.mime).toBe("application/pdf");
  });

  it("refs consecutivas que no pisan las reservadas por el escenario", async () => {
    expect(await repo.siguienteRef(2026)).toBe("INT-2026-000013");
    expect(await repo.siguienteRef(2026)).toBe("INT-2026-000014");
  });

  it("registro append-only: un id repetido no se sobrescribe", async () => {
    const [primera] = await repo.registro();
    await expect(repo.agregarEntrada(primera as EntradaRegistro)).rejects.toThrow(/ya existe/);
    expect(await repo.registro()).toHaveLength(historial + 12);
  });

  it("archivo y documento nuevos: se guardan y se leen igual", async () => {
    const bytes = await readFile("data/escenarios/lote-demo-oct/documentos/001-fac-1041.pdf");
    await repo.guardarArchivo("INT-2026-000099", { nombre: "abc.pdf", mime: "application/pdf", bytes });
    const leido = await repo.leerArchivo("INT-2026-000099");
    expect(leido?.mime).toBe("application/pdf");
    expect(Buffer.compare(leido!.bytes, bytes)).toBe(0);
    expect(await repo.documento("INT-2026-000099")).toBeNull(); // solo archivo, aún sin documento
  });

  it("ingesta de punta a punta sobre el repositorio (#11)", async () => {
    const entrada = {
      canal: "portal" as const,
      remitente: { tipo: "portal" as const, valor: "pixel.co" },
      recibido_en: AHORA,
      texto_mensaje: "Factura de prueba sin datos",
      adjuntos: [],
    };
    const doc = await ingerir(entrada, { repo, reloj: { ahora: () => AHORA } });
    expect(doc.ref_interna).toBe("INT-2026-000015");
    const e = await procesarDocumento(doc.ref_interna, { repo, ahora: AHORA, extractor: await extractorGolden("lote-demo-oct") });
    expect(e.decision).toBe("ESCALAR"); // no es un documento del escenario: el extractor falla y R1 escala
    expect((await repo.documentos()).some((d) => d.ref_interna === doc.ref_interna)).toBe(true);
  });

  it("reglas nuevas y beneficiario agregado", async () => {
    const v7 = await repo.reglasVigentes();
    const sin: Partial<typeof v7> = { ...v7, editada_por: "Laura Méndez" };
    delete sin.version;
    expect(await repo.guardarReglas(sin as Omit<typeof v7, "version">)).toBe(8);
    expect((await repo.reglasVersion(8))?.version).toBe(8);
    const base = (await repo.datosComunes()).beneficiarios[0]!;
    const nuevo = { ...base, id: "ben-prueba-contrato", nombre: "Prueba Contrato S.A.S." };
    await repo.guardarBeneficiario(nuevo);
    await expect(repo.guardarBeneficiario(nuevo)).rejects.toThrow(/ya existe/);
    await expect(repo.guardarBeneficiario(base)).rejects.toThrow(/ya existe/);
    expect((await repo.datosComunes()).beneficiarios.map((b) => b.id)).toContain("ben-prueba-contrato");
  });

  if (opciones.persistente) {
    it("después de un reinicio (otra instancia) todo sigue ahí", async () => {
      const otro = await crear();
      expect(await otro.registro()).toHaveLength(historial + 13);
      expect(await otro.pendientes()).toHaveLength(0);
      expect((await otro.reglasVigentes()).version).toBe(8);
      expect((await otro.datosComunes()).beneficiarios.map((b) => b.id)).toContain("ben-prueba-contrato");
      expect(await otro.siguienteRef(2026)).toBe("INT-2026-000016");
      expect((await otro.leerArchivo("INT-2026-000099"))?.mime).toBe("application/pdf");
    });
  }
}
