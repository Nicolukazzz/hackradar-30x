// Validación de archivos subidos (#26). Función pura: bytes → tipo real o error con código HTTP.
// El tipo se decide por los primeros bytes ("magic bytes"), nunca por la extensión ni el Content-Type
// que manda el navegador: un .exe renombrado a .pdf se rechaza.

import type { Formato } from "@/dominio/tipos";

export const MAX_BYTES = 10 * 1024 * 1024;
const LARGO_NOMBRE = 120;

export type ArchivoValido = { ok: true; formato: Extract<Formato, "pdf" | "imagen" | "xml">; mime: string; extension: string };
export type ArchivoInvalido = { ok: false; estado: 400 | 413 | 415 | 422; mensaje: string };

const empieza = (b: Uint8Array, firma: readonly number[], desde = 0) => firma.every((x, i) => b[desde + i] === x);

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG = [0xff, 0xd8, 0xff];
const BOM = [0xef, 0xbb, 0xbf];

function esXml(b: Uint8Array): boolean {
  let i = empieza(b, BOM) ? 3 : 0;
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x09 || b[i] === 0x0a || b[i] === 0x0d)) i++;
  return empieza(b, [...Buffer.from("<?xml")], i);
}

/** Texto latin1 del PDF (sin decodificar streams) para buscar marcas de la estructura. */
const crudo = (b: Uint8Array) => Buffer.from(b.buffer, b.byteOffset, b.byteLength).toString("latin1");

export function validarArchivo(bytes: Uint8Array): ArchivoValido | ArchivoInvalido {
  if (bytes.byteLength === 0) return { ok: false, estado: 400, mensaje: "El archivo está vacío." };
  if (bytes.byteLength > MAX_BYTES) return { ok: false, estado: 413, mensaje: "El archivo supera los 10 MB." };

  if (empieza(bytes, PDF)) {
    const texto = crudo(bytes);
    if (/\/Encrypt\b/.test(texto)) {
      return { ok: false, estado: 422, mensaje: "El PDF está protegido con contraseña (cifrado). Envíalo sin contraseña." };
    }
    if (!/\/Type\s*\/Page\b/.test(texto)) return { ok: false, estado: 422, mensaje: "El PDF no tiene páginas." };
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
