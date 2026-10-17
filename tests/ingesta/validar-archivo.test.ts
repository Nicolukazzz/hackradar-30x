import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { MAX_BYTES, sanearNombre, validarArchivo } from "@/ingesta/validar-archivo";

const DOCS = "data/escenarios/lote-demo-oct/documentos";
const bytes = (s: string) => new Uint8Array(Buffer.from(s, "latin1"));

describe("validarArchivo: tipo real por magic bytes (#26)", () => {
  it("acepta los PDF y PNG del dataset", async () => {
    const pdf = validarArchivo(await readFile(`${DOCS}/001-fac-1041.pdf`));
    expect(pdf).toMatchObject({ ok: true, formato: "pdf", mime: "application/pdf", extension: "pdf" });
    const png = validarArchivo(await readFile(`${DOCS}/012-es-4410.png`));
    expect(png).toMatchObject({ ok: true, formato: "imagen", mime: "image/png", extension: "png" });
  });

  it("acepta JPG y XML (con BOM y espacios antes de <?xml)", () => {
    expect(validarArchivo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]))).toMatchObject({ ok: true, mime: "image/jpeg" });
    expect(validarArchivo(bytes('\xEF\xBB\xBF  <?xml version="1.0"?><cfdi/>'))).toMatchObject({ ok: true, formato: "xml" });
  });

  it("XML sin declaración o en UTF-16 sí; HTML o SVG disfrazados de XML no", () => {
    expect(validarArchivo(bytes('<cfdi:Comprobante Version="4.0"/>'))).toMatchObject({ ok: true, formato: "xml" });
    const utf16 = new Uint8Array([0xff, 0xfe, ...Buffer.from('<?xml version="1.0"?><Invoice/>', "utf16le")]);
    expect(validarArchivo(utf16)).toMatchObject({ ok: true, formato: "xml" });
    expect(validarArchivo(bytes("<svg onload=alert(1)>"))).toMatchObject({ ok: false, estado: 415 });
    expect(validarArchivo(bytes("  <HTML><body>x</body></HTML>"))).toMatchObject({ ok: false, estado: 415 });
  });

  it("PDF con páginas dentro de /ObjStm (PDF 1.5+) se acepta; la palabra Encrypt suelta no lo bloquea", () => {
    expect(validarArchivo(bytes("%PDF-1.7\n5 0 obj << /Type /ObjStm /N 3 /Filter /FlateDecode >> stream x endstream\n%%EOF"))).toMatchObject({ ok: true });
    expect(validarArchivo(bytes("%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n(texto /Encrypt suelto)\n%%EOF"))).toMatchObject({ ok: true });
  });

  it("un ejecutable renombrado a .pdf → 415, sin importar la extensión", () => {
    const exe = bytes("MZ\x90\x00\x03\x00\x00\x00 This program cannot be run in DOS mode");
    expect(validarArchivo(exe)).toMatchObject({ ok: false, estado: 415 });
    expect(validarArchivo(bytes("<html><script>alert(1)</script>"))).toMatchObject({ ok: false, estado: 415 });
  });

  it("vacío → 400; más de 10 MB → 413", () => {
    expect(validarArchivo(new Uint8Array())).toMatchObject({ ok: false, estado: 400 });
    const grande = new Uint8Array(MAX_BYTES + 1);
    grande.set(Buffer.from("%PDF-1.7"));
    expect(validarArchivo(grande)).toMatchObject({ ok: false, estado: 413 });
  });

  it("PDF cifrado o sin páginas → 422 con mensaje claro", () => {
    const cifrado = bytes("%PDF-1.7\n1 0 obj << /Type /Page >> endobj\ntrailer << /Encrypt 5 0 R >>\n%%EOF");
    expect(validarArchivo(cifrado)).toMatchObject({ ok: false, estado: 422, mensaje: expect.stringMatching(/contraseña|cifrado/) });
    expect(validarArchivo(bytes("%PDF-1.7\n%%EOF"))).toMatchObject({ ok: false, estado: 422 });
  });
});

describe("sanearNombre", () => {
  it("quita rutas, control y caracteres raros; limita a 120", () => {
    expect(sanearNombre("../../etc/passwd")).toBe("passwd");
    expect(sanearNombre("C:\\fakepath\\Factura Octubre.pdf")).toBe("Factura Octubre.pdf");
    expect(sanearNombre("fac\u0000tura\n<script>.pdf")).toBe("factura_script_.pdf");
    expect(sanearNombre("Fatura nº 4410 — Ipê.pdf")).toBe("Fatura nº 4410 _ Ipê.pdf");
    expect(sanearNombre("a".repeat(300) + ".pdf")).toHaveLength(120);
    expect(sanearNombre("a".repeat(300) + ".pdf").endsWith(".pdf")).toBe(true);
    expect(sanearNombre("...")).toBe("documento");
  });
});
