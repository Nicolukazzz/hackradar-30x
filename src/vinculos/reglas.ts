// Reglas puras de los enlaces de proveedor (#85): sin reloj, red ni base (`ahora` inyectado). La base repite la
// validación al usar el enlace (`usar_enlace_proveedor`), atómica, como segunda capa.

import { randomBytes } from "node:crypto";

import { z } from "zod";

import type { EnlaceProveedor, EstadoEnlace } from "./tipos";

export const VIGENCIA_DIAS = 7;

export const EsquemaNuevoEnlace = z.union([
  z.strictObject({ beneficiario_id: z.string().trim().min(1).max(80) }),
  z.strictObject({ nombre: z.string().trim().min(2, { message: "Escribe el nombre del proveedor." }).max(120) }),
]);

export const EsquemaUsoEnlace = z.strictObject({
  correo: z.string().trim().toLowerCase().max(254).pipe(z.email({ message: "Escribe un correo válido." })),
});

export function estadoEnlace(e: EnlaceProveedor, ahora: string): EstadoEnlace {
  if (e.usado_en !== null) return "usado";
  if (e.revocado_en !== null) return "revocado";
  if (Date.parse(e.expira_en) <= Date.parse(ahora)) return "vencido";
  return "activo";
}

/** `ahora` + n días, como ISO UTC (timestamptz en la base). */
export function venceEn(ahora: string, dias: number): string {
  return new Date(Date.parse(ahora) + dias * 24 * 60 * 60 * 1000).toISOString();
}

// Base32 de Crockford: sin I, L, O ni U, para que se lea y se dicte sin confundir letras con números.
const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Id de conexión empresa ↔ proveedor: `PRV-XXXX-XXXX` (40 bits aleatorios). */
export function generarConexionId(bytes: Uint8Array = randomBytes(8)): string {
  const c = Array.from(bytes.subarray(0, 8), (b) => ALFABETO[b % 32]).join("");
  return `PRV-${c.slice(0, 4)}-${c.slice(4, 8)}`;
}
