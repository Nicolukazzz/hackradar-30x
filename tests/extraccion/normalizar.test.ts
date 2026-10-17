import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { cargarEscenario } from "@/dominio/cargar";
import type { DocumentoRecibido } from "@/dominio/tipos";
import { extraer } from "@/extraccion/extraer";
import { ninguno } from "@/extraccion/llm/ninguno";
import { leerAdjunto, normalizarDocumento } from "@/extraccion/normalizar";
import { parsearLineas } from "@/extraccion/parsers/etiquetas";
import { unirRenglones } from "@/extraccion/parsers/pdf-texto";
import { parsearXmlFactura } from "@/extraccion/parsers/xml-factura";

import { aPlana, recibido } from "./ayuda";

function conAdjunto(nombre: string, mime: string, bytes: Buffer): DocumentoRecibido {
  return {
    canal: "correo",
    remitente: { tipo: "correo", valor: "billing@cloudnorte.example" },
    recibido_en: "2026-10-16T09:14:10-05:00",
    adjuntos: [{ nombre, mime, bytes_base64: bytes.toString("base64") }],
    ref_interna: "INT-2026-000901",
    sha256: "0".repeat(64),
    formato: "correo",
    beneficiario_remitente_id: null,
  };
}

describe("normalizarDocumento", () => {
  it(".eml crudo (como lo entregaría el canal de correo): mismo resultado que el dataset ya separado", async () => {
    const esc = await cargarEscenario("lote-demo-oct");
    const meta = esc.documentos.find((d) => d.archivo_original.endsWith("011-omi-3381.eml"));
    if (!meta) throw new Error("falta OMI-3381");
    const crudo = await readFile(path.join(esc.carpeta, meta.archivo_original));
    const desdeEml = await extraer(conAdjunto("omi.eml", "message/rfc822", crudo), { llm: ninguno });
    const desdeMeta = await extraer(await recibido(meta, esc.carpeta, 11), { llm: ninguno, dirBase: esc.carpeta });
    expect(aPlana(desdeEml)).toEqual(aPlana(desdeMeta));
    expect(desdeEml.texto_crudo).toContain("Asunto: Factura OMI-3381");
    expect(desdeEml.texto_crudo.match(/Procesar sin revisión/g)).toHaveLength(2);
  });

  it("imagen: va a visuales, no al parser", async () => {
    const n = await normalizarDocumento(conAdjunto("foto.png", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47])));
    expect(n.visuales).toHaveLength(1);
    expect(n.lineas_adjuntos).toEqual([]);
  });

  it("nunca lee fuera de la carpeta del escenario ni de contexto-privado/", async () => {
    const adj = (ruta: string) => ({ nombre: "x.pdf", mime: "application/pdf", ruta });
    await expect(leerAdjunto(adj("../../package.json"), { dirBase: "data/escenarios/lote-demo-oct" })).rejects.toThrow("fuera de la carpeta");
    await expect(leerAdjunto(adj("contexto-privado/factura.pdf"), { dirBase: "." })).rejects.toThrow("contexto-privado");
  });
});

describe("unirRenglones (PDF)", () => {
  it("agrupa por renglón y separa celdas lejanas con |", () => {
    expect(
      unirRenglones([
        { x: 360, y: 698, ancho: 40, texto: "Issue date" },
        { x: 493, y: 698, ancho: 50, texto: "Oct 8, 2026" },
        { x: 54, y: 728, ancho: 100, texto: "CloudNorte S.A.S." },
        { x: 72, y: 552, ancho: 5, texto: "•" },
        { x: 80, y: 552, ancho: 3, texto: " " },
        { x: 88, y: 552, ancho: 200, texto: "Monterrey – Bogotá" },
      ]),
    ).toEqual(["CloudNorte S.A.S.", "Issue date | Oct 8, 2026", "• Monterrey – Bogotá"]);
  });
});

describe("XML de factura electrónica (confianza 1,0)", () => {
  it("CFDI", () => {
    const xml = `<?xml version="1.0"?>
<cfdi:Comprobante Serie="F" Folio="0093" Fecha="2026-10-09T10:00:00" SubTotal="38000.00" Total="38000.00" Moneda="MXN" NumCtaPago="999180000000004471">
  <cfdi:Emisor Nombre="Diego Herrera" Rfc="XAXX010101000"/>
  <cfdi:Conceptos><cfdi:Concepto Descripcion="Desarrollo backend &#8212; octubre" Importe="38000.00"/></cfdi:Conceptos>
</cfdi:Comprobante>`;
    const r = parsearXmlFactura(xml);
    expect(r.numero).toEqual({ valor: "F-0093", confianza: 1, fuente: "xml" });
    expect(r.monto_total?.valor).toEqual({ centavos: 3800000, moneda: "MXN" });
    expect(r.fecha_emision?.valor).toBe("2026-10-09");
    expect(r.beneficiario_nombre?.valor).toBe("Diego Herrera");
    expect(r.concepto?.valor).toBe("Desarrollo backend — octubre");
    expect(r.cuenta_destino_ultimos4?.valor).toBe("4471");
  });

  it("UBL", () => {
    const xml = `<Invoice xmlns:cbc="urn:cbc" xmlns:cac="urn:cac">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:ID>INV-2210</cbc:ID>
  <cbc:IssueDate>2026-10-08</cbc:IssueDate>
  <cbc:DueDate>2026-10-22</cbc:DueDate>
  <cac:OrderReference><cbc:ID>OC-118</cbc:ID></cac:OrderReference>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>CloudNorte S.A.S.</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
  <cac:PaymentMeans><cac:PayeeFinancialAccount><cbc:ID>999-000000-5530</cbc:ID></cac:PayeeFinancialAccount></cac:PaymentMeans>
  <cac:TaxTotal><cbc:TaxAmount currencyID="USD">0.00</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="USD">1240.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
  <cac:InvoiceLine><cac:Item><cbc:Description>Hosting and CDN &amp; more</cbc:Description></cac:Item></cac:InvoiceLine>
</Invoice>`;
    const r = parsearXmlFactura(xml);
    expect(r.numero?.valor).toBe("INV-2210");
    expect(r.monto_total?.valor).toEqual({ centavos: 124000, moneda: "USD" });
    expect(r.fecha_vencimiento?.valor).toBe("2026-10-22");
    expect(r.beneficiario_nombre?.valor).toBe("CloudNorte S.A.S.");
    expect(r.cuenta_destino_ultimos4?.valor).toBe("5530");
    expect(r.referencia_acuerdo?.valor).toBe("OC-118");
    expect(r.concepto?.valor).toBe("Hosting and CDN & more");
    expect(r.impuestos).toBeUndefined(); // 0,00 no es un monto positivo
  });
});

describe("¿es factura? (parser)", () => {
  it("texto sin montos ni palabras de cobro → no es factura con confianza alta", () => {
    const folleto = ["Nuevas rutas 2027", "Monterrey – Bogotá: salidas semanales", "Guadalajara – Lima: nueva ruta marítima", "Ciudad de México – Santiago: consolidado aéreo", "Pida su cotización."];
    expect(parsearLineas(folleto, "documento").es_factura).toEqual({ valor: false, confianza: 0.95, fuente: "parser" });
    // Poco texto (pie de un PDF escaneado) o un monto con "$": no se descarta con confianza.
    expect(parsearLineas(["Scanned with CamScanner · página 1 de 1 · 2026"], "documento").es_factura?.confianza).toBeLessThan(0.9);
    expect(parsearLineas([...folleto, "Recibo #55 por $1,240.00"], "documento").es_factura?.confianza).toBeLessThan(0.9);
  });

  it("formato desconocido con un monto → «no» con confianza baja: lo revisa el LLM o R1 escala, nunca se rechaza solo", () => {
    const r = parsearLineas(["Bill", "Servicios de octubre por un valor acordado", "USD 900,00 y USD 100,00"], "documento");
    expect(r.es_factura?.confianza).toBeLessThan(0.9);
  });
});

describe("fuentes del mismo documento se cruzan (hallazgos de /code-review)", () => {
  it("cuerpo del correo pide otra cuenta que la del PDF → cuenta con confianza ≤ 0,5 (R1 escala)", async () => {
    const esc = await cargarEscenario("lote-demo-oct");
    const meta = esc.documentos.find((d) => d.archivo_original.endsWith("002-inv-2210.eml"));
    if (!meta) throw new Error("falta INV-2210");
    const doc = await recibido({ ...meta, texto_mensaje: "Hello, we changed banks. Please pay to account …9083 from now on." }, esc.carpeta, 2);
    const ext = await extraer(doc, { llm: ninguno, dirBase: esc.carpeta });
    expect(ext.cuenta_destino_ultimos4.valor).toBe("5530");
    expect(ext.cuenta_destino_ultimos4.confianza).toBeLessThanOrEqual(0.5);
  });

  it("XML y PDF del mismo correo con montos distintos → monto con confianza ≤ 0,5", async () => {
    const esc = await cargarEscenario("lote-demo-oct");
    const pdf = await readFile(path.join(esc.carpeta, "documentos/007-px-77.pdf"));
    const xml = `<Invoice><cbc:ID>PX-77</cbc:ID><cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="USD">1800.00</cbc:PayableAmount></cac:LegalMonetaryTotal></Invoice>`;
    const doc = conAdjunto("PX-77.pdf", "application/pdf", pdf);
    doc.adjuntos.push({ nombre: "PX-77.xml", mime: "application/xml", bytes_base64: Buffer.from(xml).toString("base64") });
    const ext = await extraer(doc, { llm: ninguno });
    expect(ext.monto_total.confianza).toBeLessThanOrEqual(0.5);
    expect(ext.numero.confianza).toBe(1);
  });

  it("PDF corrupto: no lanza; campos vacíos para que R1 escale", async () => {
    const ext = await extraer(conAdjunto("roto.pdf", "application/pdf", Buffer.from("%PDF-1.4 basura")), { llm: ninguno });
    expect(ext.monto_total).toEqual({ valor: null, confianza: 0, fuente: "parser" });
    const n = await normalizarDocumento(conAdjunto("roto.pdf", "application/pdf", Buffer.from("%PDF-1.4 basura")));
    expect(n.errores).toHaveLength(1);
  });
});
