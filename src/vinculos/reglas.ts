// Reglas puras del portal del proveedor (#85): sin reloj, red ni base (`ahora` inyectado).

import { z } from "zod";

import { normalizarCodigo } from "./codigo";
import type { EnlaceProveedor, EstadoEnlace } from "./tipos";

/** Días que vale un enlace del portal. */
export const VIGENCIA_DIAS = 30;

const Correo = z.string().trim().toLowerCase().max(254).pipe(z.email({ message: "Escribe un correo válido." }));
const Codigo = z
  .string()
  .max(20)
  .transform((t, ctx) => {
    const c = normalizarCodigo(t);
    if (c === null) ctx.addIssue({ code: "custom", message: "El código tiene 8 caracteres, como K7M2-Q9XD." });
    return c ?? "";
  });

/** Enlace válido: nombre del proveedor, su correo y un código de 8 caracteres. */
export const EsquemaNuevoEnlace = z.strictObject({
  nombre: z.string().trim().min(2, { message: "Escribe el nombre del proveedor." }).max(120),
  correo: Correo,
  codigo: Codigo,
});

/** Código nuevo para un enlace existente. */
export const EsquemaCambioCodigo = z.strictObject({ codigo: Codigo });

/** Lo que escribe el proveedor para entrar: correo y código (sin importar guiones ni mayúsculas). */
export const EsquemaAcceso = z.strictObject({ correo: Correo, codigo: Codigo });

/** Estado de un enlace en `ahora`: revocado, vencido o activo. */
export function estadoEnlace(e: Pick<EnlaceProveedor, "revocado_en" | "expira_en">, ahora: string): EstadoEnlace {
  if (e.revocado_en !== null) return "revocado";
  if (Date.parse(e.expira_en) <= Date.parse(ahora)) return "vencido";
  return "activo";
}

/** `ahora` + n días, como ISO UTC (timestamptz en la base). */
export function venceEn(ahora: string, dias: number): string {
  return new Date(Date.parse(ahora) + dias * 24 * 60 * 60 * 1000).toISOString();
}
