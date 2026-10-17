import { describe, expect, it, vi } from "vitest";

import { cargarDatosComunes, cargarEscenario } from "@/dominio/cargar";
import { relojFijo } from "@/dominio/reloj";
import type { DocumentoEntrante, EntradaRegistro, Idioma } from "@/dominio/tipos";
import { cargarEscenarioPorIngesta, extractorGolden } from "@/ingesta/cargar-escenario";
import { beneficiarioDelRemitente, formatoDe, ingerir } from "@/ingesta/ingerir";
import { type Extractor, procesarDocumento } from "@/ingesta/pipeline";
import { textoRespuesta } from "@/ingesta/respuesta";
import { crearRepositorioMemoria } from "@/repositorio/memoria";

const reloj = relojFijo("2026-10-16T09:24:00-05:00");

async function repoVacio(id = "lote-demo-oct") {
  return crearRepositorioMemoria(id, undefined, { lote: "vacio" });
}

/** Extractor golden con espía: cuenta cuántas veces se "lee" un documento (= llamadas al LLM). */
async function espia(id = "lote-demo-oct") {
  const golden = await extractorGolden(id);
  return vi.fn<Extractor>(golden);
}

/** Un documento del dataset tal como lo mandaría su canal. */
async function entradaDelDataset(id: string, archivo: string): Promise<{ entrada: DocumentoEntrante; carpeta: string }> {
  const esc = await cargarEscenario(id);
  const meta = esc.documentos.find((d) => d.archivo_original.endsWith(archivo));
  if (!meta) throw new Error(`sin ${archivo}`);
  const entrada: DocumentoEntrante = { ...meta };
  delete (entrada as Partial<typeof meta>).archivo_original;
  return { entrada, carpeta: esc.carpeta };
}

describe("ingerir (§8 pasos 1–2)", () => {
  it("asigna refs consecutivas por año y guarda documento y archivo", async () => {
    const repo = await repoVacio();
    const a = await entradaDelDataset("lote-demo-oct", "001-fac-1041.pdf");
    const b = await entradaDelDataset("lote-demo-oct", "004-jpo-10.txt");
    const d1 = await ingerir(a.entrada, { repo, reloj, dirBase: a.carpeta });
    const d2 = await ingerir(b.entrada, { repo, reloj, dirBase: b.carpeta });
    expect([d1.ref_interna, d2.ref_interna]).toEqual(["INT-2026-000001", "INT-2026-000002"]);
    expect(await repo.documento("INT-2026-000002")).toMatchObject({ formato: "chat", beneficiario_remitente_id: "ben-juan-pablo-ortiz" });
    expect((await repo.leerArchivo("INT-2026-000001"))?.mime).toBe("application/pdf");
    expect(d1.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("dos ingestas simultáneas nunca comparten ref", async () => {
    const repo = await repoVacio();
    const { entrada, carpeta } = await entradaDelDataset("lote-demo-oct", "004-jpo-10.txt");
    const docs = await Promise.all(Array.from({ length: 5 }, () => ingerir(entrada, { repo, reloj, dirBase: carpeta })));
    expect(new Set(docs.map((d) => d.ref_interna)).size).toBe(5);
  });

  it("rechaza un DocumentoEntrante inválido", async () => {
    const repo = await repoVacio();
    const mala = { canal: "fax", remitente: { tipo: "correo", valor: "x@y.example" }, adjuntos: [] } as unknown as DocumentoEntrante;
    await expect(ingerir(mala, { repo, reloj })).rejects.toThrow();
  });

  it("remitente → beneficiario: correo exacto en minúsculas, nunca por dominio parecido", async () => {
    const { beneficiarios } = await cargarDatosComunes();
    const de = (tipo: "correo" | "telegram" | "portal" | "interno", valor: string) => beneficiarioDelRemitente({ tipo, valor }, beneficiarios);
    expect(de("correo", "billing@cloudnorte.example")).toBe("ben-cloudnorte");
    expect(de("correo", "Billing@CloudNorte.example")).toBe("ben-cloudnorte");
    expect(de("correo", "pagos-cloudnorte@gmail.example")).toBeNull();
    expect(de("correo", "billing@cloudnorte.example.evil")).toBeNull();
    expect(de("telegram", "700100003")).toBe("ben-diego-herrera");
    expect(de("portal", "pixel.co")).toBe("ben-pixel-co");
    expect(de("interno", "cuentas@nebula.example")).toBeNull();
  });

  it("formato por canal, mime y extensión", () => {
    const adj = (nombre: string, mime: string) => [{ nombre, mime, bytes_base64: "" }];
    expect(formatoDe({ canal: "correo", adjuntos: adj("f.pdf", "application/pdf") })).toBe("correo");
    expect(formatoDe({ canal: "telegram", adjuntos: [] })).toBe("chat");
    expect(formatoDe({ canal: "telegram", adjuntos: adj("foto", "image/jpeg") })).toBe("imagen");
    expect(formatoDe({ canal: "portal", adjuntos: adj("cfdi.xml", "text/xml") })).toBe("xml");
    expect(formatoDe({ canal: "portal", adjuntos: adj("factura.pdf", "application/pdf") })).toBe("pdf");
  });
});

describe("procesarDocumento (§8 pasos 3–7)", () => {
  it("mismo archivo dos veces: la segunda FRENA por R2 sin volver a extraer", async () => {
    const repo = await repoVacio();
    const extractor = await espia();
    const { entrada, carpeta } = await entradaDelDataset("lote-demo-oct", "002-inv-2210.eml");
    const deps = { repo, ahora: reloj.ahora(), extractor };

    const primera = await procesarDocumento((await ingerir(entrada, { repo, reloj, dirBase: carpeta })).ref_interna, deps);
    const segunda = await procesarDocumento((await ingerir(entrada, { repo, reloj, dirBase: carpeta })).ref_interna, deps);

    expect(primera.decision).toBe("PAGAR");
    expect(segunda).toMatchObject({ decision: "FRENAR", reglas_que_fallaron: ["R2"] });
    expect(segunda.evaluaciones.find((e) => e.id === "R2")?.comparacion).toContain("mismo archivo (sha256)");
    expect(extractor).toHaveBeenCalledTimes(1);
  });

  it("un documento ya decidido no se decide dos veces", async () => {
    const repo = await repoVacio();
    const { entrada, carpeta } = await entradaDelDataset("lote-demo-oct", "001-fac-1041.pdf");
    const { ref_interna } = await ingerir(entrada, { repo, reloj, dirBase: carpeta });
    const deps = { repo, ahora: reloj.ahora(), extractor: await espia() };
    await procesarDocumento(ref_interna, deps);
    await expect(procesarDocumento(ref_interna, deps)).rejects.toThrow(/ya tiene decisión/);
    await expect(procesarDocumento("INT-2026-999999", deps)).rejects.toThrow(/primero ingerir/);
  });
});

describe("escenarios completos por la ingesta", () => {
  it("lote-demo-oct: refs INT-2026-000001…012 y las decisiones de §11.4", async () => {
    const esc = await cargarEscenario("lote-demo-oct");
    const entradas = await cargarEscenarioPorIngesta("lote-demo-oct", { repo: await repoVacio(), extractor: await espia() });
    expect(entradas.map((e) => e.ref_interna)).toEqual(esc.esperado.map((x) => x.ref_esperada));
    expect(entradas.map((e) => [e.decision, e.reglas_que_fallaron])).toEqual(esc.esperado.map((x) => [x.decision, x.reglas_que_fallan]));
  });

  it("trampas-extra: el duplicado exacto no llama al extractor (13 lecturas para 14 documentos)", async () => {
    const esc = await cargarEscenario("trampas-extra");
    const extractor = await espia("trampas-extra");
    const entradas = await cargarEscenarioPorIngesta("trampas-extra", { repo: await repoVacio("trampas-extra"), extractor });
    expect(entradas.map((e) => e.decision)).toEqual(esc.esperado.map((x) => x.decision));
    expect(entradas[0]?.ref_interna).toBe("INT-2026-000013");
    expect(extractor).toHaveBeenCalledTimes(13);
  });
});

describe("respuesta al remitente (§8 paso 8)", () => {
  const PROHIBIDO = /presupuesto|l[íi]mite|budget|limit|or[çc]amento|USD|R\d+\b|disponible|m[áa]ximo/i;

  it("nunca revela límites, presupuesto ni reglas, en ningún idioma ni decisión", async () => {
    const todas: EntradaRegistro[] = [];
    for (const id of ["lote-demo-oct", "trampas-extra"]) {
      todas.push(...(await cargarEscenarioPorIngesta(id, { repo: await repoVacio(id), extractor: await espia(id) })));
    }
    for (const e of todas) {
      for (const idioma of ["es", "en", "pt"] as Idioma[]) {
        const texto = textoRespuesta(e, idioma, { urlPortal: "https://portal.example" });
        expect(texto).not.toMatch(PROHIBIDO);
        expect(texto).toContain(e.ref_interna);
      }
    }
  });

  it("dice el estado y pide vincular el canal cuando falla R11", async () => {
    const entradas = await cargarEscenarioPorIngesta("lote-demo-oct", { repo: await repoVacio(), extractor: await espia() });
    const por = (n: string) => entradas.find((e) => e.factura_numero === n)!;
    const r = (n: string, idioma: Idioma = "es") => textoRespuesta(por(n), idioma, { urlPortal: "https://portal.example" });
    expect(r("FAC-1041")).toBe("Recibimos tu factura FAC-1041. Ref INT-2026-000001. Estado: aprobada para pago.");
    expect(r("PX-77")).toContain("no se pagará: el monto o el concepto no coincide con lo acordado");
    expect(r("LF-2026-10")).toContain("en revisión por el equipo de finanzas");
    expect(r("TD-001")).toContain("vincula este correo en el portal: https://portal.example");
    expect(r("INV-2210", "en")).toContain("approved for payment");
  });
});
