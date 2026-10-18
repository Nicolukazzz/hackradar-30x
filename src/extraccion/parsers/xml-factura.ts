// Factura electrónica XML (CFDI de México o UBL 2.1 simplificado). Campos directos: confianza 1,0, fuente "xml".
// Lector mínimo por expresiones regulares: solo lee atributos y elementos conocidos, nunca ejecuta nada.

import type { Campo } from "@/dominio/tipos";

import type { ExtraccionParcial, NombreCampo, ValoresCampos } from "../tipos";
import { aDinero, esMoneda } from "./valores";

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodificar(texto: string): string {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ENTIDADES[e] ?? "")
    .trim();
}

/** Atributo de la primera etiqueta `<prefijo:nombre …>` (prefijo opcional). */
function atributo(xml: string, etiqueta: string, attr: string): string | null {
  const tag = new RegExp(`<(?:[\\w-]+:)?${etiqueta}\\b([^>]*)>`, "i").exec(xml);
  const m = tag?.[1] ? new RegExp(`\\b${attr}\\s*=\\s*"([^"]*)"`, "i").exec(tag[1]) : null;
  return m?.[1] !== undefined ? decodificar(m[1]) : null;
}

/** Texto y atributos del primer elemento `<prefijo:nombre>…</prefijo:nombre>` de `xml`. */
function elemento(xml: string, nombre: string): { texto: string; attrs: string } | null {
  const m = new RegExp(`<(?:[\\w-]+:)?${nombre}\\b([^>]*)>([^<]*)</(?:[\\w-]+:)?${nombre}>`, "i").exec(xml);
  return m ? { attrs: m[1] ?? "", texto: decodificar(m[2] ?? "") } : null;
}

function bloque(xml: string, nombre: string): string | null {
  const m = new RegExp(`<(?:[\\w-]+:)?${nombre}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${nombre}>`, "i").exec(xml);
  return m?.[1] ?? null;
}

function moneda(attrs: string): string | null {
  return /\bcurrencyID\s*=\s*"([A-Z]{3,4})"/i.exec(attrs)?.[1]?.toUpperCase() ?? null;
}

function fechaIso(texto: string | null): string | null {
  const m = texto ? /^(\d{4}-\d{2}-\d{2})/.exec(texto) : null;
  return m?.[1] ?? null;
}

function ultimos4(texto: string | null): string | null {
  const digitos = (texto ?? "").replace(/\D/g, "");
  return digitos.length >= 4 ? digitos.slice(-4) : null;
}

/** true si el texto es un CFDI o una factura UBL. */
export function esXmlFactura(texto: string): boolean {
  return /<(?:[\w-]+:)?(Comprobante|Invoice)\b/.test(texto);
}

/** Campos directos de la factura electrónica, con confianza 1 y fuente `xml`. */
export function parsearXmlFactura(xml: string): ExtraccionParcial {
  const r: ExtraccionParcial = {};
  const poner = <K extends NombreCampo>(k: K, valor: ValoresCampos[K] | null) => {
    if (valor !== null) (r as Record<string, Campo<unknown>>)[k] = { valor, confianza: 1, fuente: "xml" };
  };

  if (/<(?:[\w-]+:)?Comprobante\b/i.test(xml)) {
    // CFDI 4.0: atributos en mayúscula inicial.
    const mon = atributo(xml, "Comprobante", "Moneda") ?? "MXN";
    const dinero = (v: string | null) => (v && esMoneda(mon) ? aDinero(mon, v) : null);
    const serie = atributo(xml, "Comprobante", "Serie");
    const folio = atributo(xml, "Comprobante", "Folio");
    poner("es_factura", true);
    poner("numero", folio ? (serie ? `${serie}-${folio}` : folio) : null);
    poner("fecha_emision", fechaIso(atributo(xml, "Comprobante", "Fecha")));
    poner("monto_total", dinero(atributo(xml, "Comprobante", "Total")));
    poner("subtotal", dinero(atributo(xml, "Comprobante", "SubTotal")));
    poner("impuestos", dinero(atributo(xml, "Impuestos", "TotalImpuestosTrasladados")));
    poner("beneficiario_nombre", atributo(xml, "Emisor", "Nombre"));
    poner("concepto", atributo(xml, "Concepto", "Descripcion"));
    poner("cuenta_destino_ultimos4", ultimos4(atributo(xml, "Comprobante", "NumCtaPago")));
    r.idioma = "es";
    return r;
  }

  // UBL 2.1 (Invoice).
  const total = elemento(xml, "PayableAmount");
  const subtotal = elemento(xml, "TaxExclusiveAmount") ?? elemento(xml, "LineExtensionAmount");
  const impuestos = elemento(xml, "TaxAmount");
  const dinero = (e: { texto: string; attrs: string } | null) => {
    const mon = e ? moneda(e.attrs) : null;
    return e && mon ? aDinero(mon, e.texto) : null;
  };
  const proveedor = bloque(xml, "AccountingSupplierParty") ?? "";
  const cuenta = bloque(xml, "PayeeFinancialAccount") ?? "";
  poner("es_factura", true);
  poner("numero", elemento(xml, "ID")?.texto ?? null);
  poner("fecha_emision", fechaIso(elemento(xml, "IssueDate")?.texto ?? null));
  poner("fecha_vencimiento", fechaIso(elemento(xml, "DueDate")?.texto ?? null));
  poner("monto_total", dinero(total));
  poner("subtotal", dinero(subtotal));
  poner("impuestos", dinero(impuestos));
  poner("beneficiario_nombre", (elemento(proveedor, "RegistrationName") ?? elemento(proveedor, "Name"))?.texto ?? null);
  poner("concepto", (elemento(xml, "Description") ?? elemento(xml, "Note"))?.texto ?? null);
  poner("cuenta_destino_ultimos4", ultimos4(elemento(cuenta, "ID")?.texto ?? null));
  const ref = elemento(bloque(xml, "OrderReference") ?? bloque(xml, "ContractDocumentReference") ?? "", "ID");
  poner("referencia_acuerdo", ref?.texto ?? null);
  return r;
}
