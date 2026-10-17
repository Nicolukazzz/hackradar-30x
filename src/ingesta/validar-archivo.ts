// Validación de archivos subidos (#26). Función pura: bytes → tipo real o error con código HTTP.
// El tipo se decide por los primeros bytes ("magic bytes"), nunca por la extensión ni el Content-Type
// que manda el navegador: un .exe renombrado a .pdf se rechaza.

import type { Formato } from "@/dominio/tipos";

import { MAX_BYTES } from "./limites";

export { MAX_BYTES };
const LARGO_NOMBRE = 120;

export type ArchivoValido = { ok: true; formato: Extract<Formato, "pdf" | "imagen" | "xml">; mime: string; extension: string };
export type ArchivoInvalido = { ok: false; estado: 400 | 413 | 415 | 422; mensaje: string };

const empieza = (b: Uint8Array, firma: readonly number[], desde = 0) => firma.every((x, i) => b[desde + i] === x);

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG = [0xff, 0xd8, 0xff];
const BOM = [0xef, 0xbb, 0xbf];

/** Texto del inicio del archivo, respetando BOM UTF-8 o UTF-16. */
function inicioComoTexto(b: Uint8Array): string {
  const inicio = Buffer.from(b.buffer, b.byteOffset, Math.min(b.byteLength, 512));
  if (inicio[0] === 0xff && inicio[1] === 0xfe) return inicio.subarray(2).toString("utf16le");
  if (inicio[0] === 0xfe && inicio[1] === 0xff) return Buffer.from(inicio.subarray(2)).swap16().toString("utf16le");
  return (empieza(inicio, BOM) ? inicio.subarray(3) : inicio).toString("utf8");
}

/** XML con o sin declaración (`<?xml` o directo `<cfdi:Comprobante`), pero nunca HTML ni SVG (podrían ejecutar script). */
function esXml(b: Uint8Array): boolean {
  const texto = inicioComoTexto(b).trimStart();
  if (texto.startsWith("<?xml")) return true;
  const raiz = /^<([A-Za-z_][\w:.-]*)/.exec(texto)?.[1]?.toLowerCase();
  return raiz !== undefined && !["html", "svg", "script", "body", "head"].includes(raiz);
}

/** Texto latin1 del PDF (sin decodificar streams) para buscar marcas de la estructura. */
const crudo = (b: Uint8Array) => Buffer.from(b.buffer, b.byteOffset, b.byteLength).toString("latin1");

export function validarArchivo(bytes: Uint8Array): ArchivoValido | ArchivoInvalido {
  if (bytes.byteLength === 0) return { ok: false, estado: 400, mensaje: "El archivo está vacío." };
  if (bytes.byteLength > MAX_BYTES) return { ok: false, estado: 413, mensaje: "El archivo supera los 10 MB." };

  if (empieza(bytes, PDF)) {
    const texto = crudo(bytes);
    // "/Encrypt 5 0 R" en el trailer o en el diccionario del xref stream (siempre sin comprimir), no la palabra suelta.
    if (/\/Encrypt\s+\d+\s+\d+\s+R\b/.test(texto)) {
      return { ok: false, estado: 422, mensaje: "El PDF está protegido con contraseña (cifrado). Envíalo sin contraseña." };
    }
    // PDF 1.5+ puede guardar los objetos (y las páginas) dentro de /ObjStm comprimidos: ahí no se ven sin descomprimir.
    if (!/\/Type\s*\/Page\b/.test(texto) && !/\/ObjStm\b/.test(texto)) {
      return { ok: false, estado: 422, mensaje: "El PDF no tiene páginas." };
    }
    return { ok: true, formato: "pdf", mime: "application/pdf", extension: "pdf" };
  }
  if (empieza(bytes, PNG)) return { ok: true, formato: "imagen", mime: "image/png", extension: "png" };
  if (empieza(bytes, JPG)) return { ok: true, formato: "imagen", mime: "image/jpeg", extension: "jpg" };
  if (esXml(bytes)) return { ok: true, formato: "xml", mime: "application/xml", extension: "xml" };
  return { ok: false, estado: 415, mensaje: "Solo se aceptan PDF, PNG, JPG o XML de factura." };
}

/**
 * Nombre original como metadato: sin rutas, sin caracteres de control ni de marcado, ≤ 120 caracteres
 * conservando la extensión. Nunca se usa para guardar en disco (se guarda como `{sha256}.{ext}`).
 */
export function sanearNombre(nombre: string): string {
  const base = nombre.split(/[\\/]/).at(-1) ?? "";
  const limpio = base
    .replace(/\p{Cc}/gu, "")
    .replace(/[^\p{L}\p{N} ._()º-]/gu, "_")
    .replace(/^[.\s]+/, "")
    .trim();
  if (!limpio || /^[._]+$/.test(limpio)) return "documento";
  if (limpio.length <= LARGO_NOMBRE) return limpio;
  const punto = limpio.lastIndexOf(".");
  const ext = punto > 0 && limpio.length - punto <= 6 ? limpio.slice(punto) : "";
  return limpio.slice(0, LARGO_NOMBRE - ext.length) + ext;
}
