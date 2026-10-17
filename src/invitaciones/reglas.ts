// Reglas puras de las invitaciones de proveedor (#28): sin reloj, red ni base (`ahora` inyectado). La base repite
// la validación al usar el enlace (`usar_invitacion_proveedor`), atómica, como segunda capa.

import { z } from "zod";

import type { EstadoInvitacionProveedor, InvitacionProveedor } from "./tipos";

export const VIGENCIA_DIAS_POR_DEFECTO = 7;
export const VIGENCIA_DIAS_MAXIMA = 30;
export const USOS_POR_DEFECTO = 5;
export const USOS_MAXIMOS = 20;

export const EsquemaNuevaInvitacionProveedor = z
  .strictObject({
    nombre_esperado: z.string().trim().max(120).nullable().optional(),
    correo_esperado: z.string().trim().toLowerCase().max(254).pipe(z.union([z.literal(""), z.email()])).nullable().optional(),
    dias_vigencia: z.number().int().min(1).max(VIGENCIA_DIAS_MAXIMA).default(VIGENCIA_DIAS_POR_DEFECTO),
    usos_max: z.number().int().min(1).max(USOS_MAXIMOS).default(USOS_POR_DEFECTO),
  })
  .transform((v) => ({ ...v, nombre_esperado: v.nombre_esperado || null, correo_esperado: v.correo_esperado || null }));

export type EntradaInvitacionProveedor = z.input<typeof EsquemaNuevaInvitacionProveedor>;

export function estadoInvitacion(inv: InvitacionProveedor, ahora: string): EstadoInvitacionProveedor {
  if (inv.revocada_en !== null) return "revocada";
  if (inv.usos >= inv.usos_max) return "agotada";
  if (Date.parse(inv.expira_en) <= Date.parse(ahora)) return "vencida";
  return "activa";
}

/** `ahora` + n días, como ISO UTC (timestamptz en la base). */
export function venceEn(ahora: string, dias: number): string {
  return new Date(Date.parse(ahora) + dias * 24 * 60 * 60 * 1000).toISOString();
}

export { correoDeInvitacion, esRemitenteInvitacion, remitenteInvitacion } from "@/dominio/remitente";
