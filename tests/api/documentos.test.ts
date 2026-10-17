import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import { GET as getArchivo } from "@/app/api/documentos/[ref]/archivo/route";
import { POST as postDocumento } from "@/app/api/documentos/route";
import { GET as getBandeja } from "@/app/api/bandeja/route";
import { crearLimitador } from "@/lib/limite";
import { fijarRepositorio } from "@/repositorio";
import { crearRepositorioMemoria } from "@/repositorio/memoria";

import { comoProveedor, comoSesion, peticion, repoProcesado, TESORERIA } from "./ayuda";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/sesion", async () => (await import("./ayuda")).sesionFalsa);
vi.mock("@/lib/auth/auditoria", () => ({ auditar: () => undefined }));
vi.stubEnv("LLM_PROVIDER", "ninguno");

const DOCS = "data/escenarios/lote-demo-oct/documentos";

function subir(bytes: Uint8Array, nombre: string, tipo = "application/pdf", extra?: (f: FormData) => void) {
  const f = new FormData();
  f.append("archivo", new File([new Uint8Array(bytes)], nombre, { type: tipo }));
  extra?.(f);
  return postDocumento(peticion("http://x/api/documentos", { method: "POST", body: f }));
}

const archivo = (ref: string) =>
  getArchivo(peticion(`http://x/api/documentos/${ref}/archivo`), { params: Promise.resolve({ ref }) } as RouteContext<"/api/documentos/[ref]/archivo">);

async function repoSinProcesar() {
  fijarRepositorio(await crearRepositorioMemoria("lote-demo-oct"));
  comoSesion(TESORERIA);
}

describe("POST /api/documentos (#26)", () => {
  it("tesorería sube 001-fac-1041.pdf → ref INT nueva, decidida y visible en la Bandeja", async () => {
    await repoSinProcesar();
    const res = await subir(await readFile(`${DOCS}/001-fac-1041.pdf`), "001-fac-1041.pdf");
    expect(res.status).toBe(201);
    const r = await res.json();
    expect(r).toMatchObject({ ref_interna: "INT-2026-000013", estado: "PAGAR" });
    const bandeja = await (await getBandeja(peticion("http://x/api/bandeja"))).json();
    expect(bandeja.filas.map((f: { ref_interna: string }) => f.ref_interna)).toContain("INT-2026-000013");
  });

  it("el mismo archivo dos veces: la segunda frena por duplicado", async () => {
    await repoSinProcesar();
    const pdf = await readFile(`${DOCS}/001-fac-1041.pdf`);
    await subir(pdf, "a.pdf");
    const r = await (await subir(pdf, "b.pdf")).json();
    expect(r.estado).toBe("FRENAR");
  });

  it("ejecutable renombrado a .pdf → 415; más de 10 MB → 413; dos archivos o sin multipart → 400; sin sesión → 401", async () => {
    await repoSinProcesar();
    expect((await subir(new Uint8Array(Buffer.from("MZ\x90\x00 programa", "latin1")), "factura.pdf")).status).toBe(415);
    const grande = new Uint8Array(10 * 1024 * 1024 + 1);
    grande.set(Buffer.from("%PDF-1.7"));
    expect((await subir(grande, "grande.pdf")).status).toBe(413);
    const pdf = await readFile(`${DOCS}/001-fac-1041.pdf`);
    expect((await subir(pdf, "a.pdf", "application/pdf", (f) => f.append("otro", new File([new Uint8Array(pdf)], "b.pdf")))).status).toBe(400);
    const json = peticion("http://x/api/documentos", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    expect((await postDocumento(json)).status).toBe(400);
    comoSesion(null);
    expect((await subir(pdf, "a.pdf")).status).toBe(401);
  });

  it("proveedor: el remitente sale de su sesión, recibe el aviso sin reglas internas y solo ve sus archivos", async () => {
    await repoProcesado();
    comoProveedor("ben-ana-maria-gomez");
    // Una cuenta de cobro nueva de Ana María (mismo formato que FAC-1041, otro archivo): el sistema no la conoce.
    const res = await subir(await readFile(`${DOCS}/001-fac-1041.pdf`), "cuenta.pdf");
    const r = await res.json();
    expect(res.status).toBe(201);
    expect(r.mensaje).toContain(r.ref_interna);
    expect(r.mensaje).not.toMatch(/presupuesto|l[íi]mite|USD|R\d/i);
    expect((await archivo(r.ref_interna)).status).toBe(200);
    // documento de otro (del lote, no lo subió ella) → 404, sin confirmar que exista
    expect((await archivo("INT-2026-000007")).status).toBe(404);
    comoProveedor("ben-pixel-co");
    expect((await archivo(r.ref_interna)).status).toBe(404);
  });

  it("proveedor sin usuario de portal (CloudNorte): R11 cumple por la sesión y puede ver lo que subió", async () => {
    await repoSinProcesar();
    comoProveedor("ben-cloudnorte");
    const r = await (await subir(await readFile(`${DOCS}/adjuntos/002-inv-2210.pdf`), "inv.pdf")).json();
    expect((await archivo(r.ref_interna)).status).toBe(200);
    const { obtenerRepositorio } = await import("@/repositorio");
    const e = (await (await obtenerRepositorio()).registro({ ref_interna: r.ref_interna, tipo: ["DECISION_AGENTE"] }))[0];
    expect(e?.evaluaciones.find((x) => x.id === "R11")?.resultado).toBe("CUMPLE");
  });

  it("si el registro falla después de ingerir: 503 con la ref, sin decir que no se registró nada", async () => {
    const { subirDocumento } = await import("@/servicios/subida");
    const base = await crearRepositorioMemoria("lote-demo-oct");
    const roto = { ...base, agregarEntrada: async () => Promise.reject(new Error("base caída")) };
    const pdf = await readFile(`${DOCS}/001-fac-1041.pdf`);
    const extractor = async () => Promise.reject(new Error("sin LLM"));
    await expect(
      subirDocumento({ bytes: pdf, nombre: "f.pdf" }, TESORERIA, { repo: roto, ahora: "2026-10-16T10:00:00-05:00", extractor, urlPortal: "x" }),
    ).rejects.toMatchObject({ estado: 503, message: expect.stringContaining("INT-2026-000013") });
  });

  it("un XML se descarga (attachment), nunca se muestra en el navegador", async () => {
    await repoSinProcesar();
    const xml = new Uint8Array(Buffer.from('<?xml version="1.0"?><factura/>'));
    const r = await (await subir(xml, "cfdi.xml", "text/xml")).json();
    const res = await archivo(r.ref_interna);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("límite de 20 subidas por minuto por usuario", () => {
    let t = 0;
    const l = crearLimitador({ maximo: 20, ventanaMs: 60_000, ahora: () => t });
    for (let i = 0; i < 20; i++) expect(l.permitir("u")).toBe(true);
    expect(l.permitir("u")).toBe(false);
    expect(l.permitir("otro")).toBe(true);
    t = 60_001;
    expect(l.permitir("u")).toBe(true);
  });
});

describe("rutas del panel con conRol (#25/#26)", () => {
  it("un proveedor no puede leer la bandeja, el registro ni procesar (403)", async () => {
    await repoProcesado();
    comoProveedor("ben-pixel-co");
    expect((await getBandeja(peticion("http://x/api/bandeja"))).status).toBe(403);
    const { GET: getRegistro } = await import("@/app/api/registro/route");
    expect((await getRegistro(peticion("http://x/api/registro"))).status).toBe(403);
    const { POST: postProcesar } = await import("@/app/api/procesar/route");
    expect((await postProcesar(peticion("http://x/api/procesar", { method: "POST" }))).status).toBe(403);
  });

  it("una escritura sin Origin del mismo sitio → 403 (CSRF)", async () => {
    await repoProcesado();
    const { POST: postProcesar } = await import("@/app/api/procesar/route");
    expect((await postProcesar(new Request("http://x/api/procesar", { method: "POST" }))).status).toBe(403);
  });
});
