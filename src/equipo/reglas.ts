// Reglas del equipo, puras (sin reloj, red ni base): `ahora` llega inyectado. Las mismas comprobaciones viven
// también en la base (trigger del último admin, `aceptar_invitacion`) como segunda capa.

import { z } from "zod";

import { ROLES, type Rol } from "@/lib/auth/permisos";

import { ErrorEquipo, MENSAJE_ULTIMO_ADMIN, type EstadoInvitacion, type Invitacion, type Miembro } from "./tipos";

/** #80: 72 horas. Un enlace que viaja por correo no debería quedar vivo una semana. */
export const VIGENCIA_DIAS_POR_DEFECTO = 3;
/** Máximo de días que puede durar una invitación. */
export const VIGENCIA_DIAS_MAXIMA = 30;
/** USD 1.000.000 en centavos: tope de cordura para el límite de un aprobador. */
const LIMITE_MAXIMO_CENTAVOS = 100_000_000;

const limite = z.number().int().positive().max(LIMITE_MAXIMO_CENTAVOS).nullable();

/** Límite solo para `aprobador`; para el resto se ignora (admin aprueba cualquier monto, tesorería no aprueba). */
function conLimiteCoherente<T extends { rol: Rol; limite_aprobacion_usd?: number | null | undefined }>(v: T) {
  return { ...v, limite_aprobacion_usd: v.rol === "aprobador" ? (v.limite_aprobacion_usd ?? null) : null };
}

/** Invitación válida: rol, correo de la persona, límite solo para aprobadores y vigencia de 1 a 30 días. */
export const EsquemaNuevaInvitacion = z
  .strictObject({
    rol: z.enum(ROLES),
    limite_aprobacion_usd: limite.optional(),
    // #80: obligatorio. El enlace va a ese correo y solo esa dirección puede crear la cuenta con él.
    correo_esperado: z.string().trim().toLowerCase().max(254).pipe(z.email({ message: "Escribe el correo de la persona." })),
    dias_vigencia: z.number().int().min(1).max(VIGENCIA_DIAS_MAXIMA).default(VIGENCIA_DIAS_POR_DEFECTO),
  })
  .transform(conLimiteCoherente);

/** Datos de una invitación antes de validar. */
export type EntradaInvitacion = z.input<typeof EsquemaNuevaInvitacion>;

/** Cambio de rol o límite válido. */
export const EsquemaCambioMiembro = z
  .strictObject({ rol: z.enum(ROLES), limite_aprobacion_usd: limite.optional() })
  .transform(conLimiteCoherente);

/** Cambio de rol o límite ya validado. */
export type CambioMiembro = z.output<typeof EsquemaCambioMiembro>;

/** Estado de una invitación en `ahora`: revocada, usada, vencida o activa (en ese orden de prioridad). */
export function estadoInvitacion(inv: Invitacion, ahora: string): EstadoInvitacion {
  if (inv.revocada_en !== null) return "revocada";
  if (inv.usos >= inv.usos_max) return "usada";
  if (Date.parse(inv.expira_en) <= Date.parse(ahora)) return "vencida";
  return "activa";
}

/** `ahora` + n días, como ISO UTC (lo guarda la base como timestamptz). */
export function venceEn(ahora: string, dias: number): string {
  return new Date(Date.parse(ahora) + dias * 24 * 60 * 60 * 1000).toISOString();
}

function buscar(miembros: readonly Miembro[], usuario_id: string): Miembro {
  const m = miembros.find((x) => x.usuario_id === usuario_id);
  if (!m) throw new ErrorEquipo(404, "Esa persona no es miembro de la empresa.");
  return m;
}

function quedanOtrosAdmins(miembros: readonly Miembro[], usuario_id: string): boolean {
  return miembros.some((m) => m.rol === "admin" && m.usuario_id !== usuario_id);
}

/** Cambiar rol o límite: la empresa nunca se queda sin admin. */
export function validarCambio(miembros: readonly Miembro[], usuario_id: string, cambio: CambioMiembro): Miembro {
  const m = buscar(miembros, usuario_id);
  if (m.rol === "admin" && cambio.rol !== "admin" && !quedanOtrosAdmins(miembros, usuario_id)) {
    throw new ErrorEquipo(409, MENSAJE_ULTIMO_ADMIN);
  }
  return m;
}

/** Quitar a alguien de la empresa (no borra su cuenta): la empresa nunca se queda sin admin. */
export function validarQuitar(miembros: readonly Miembro[], usuario_id: string): Miembro {
  const m = buscar(miembros, usuario_id);
  if (m.rol === "admin" && !quedanOtrosAdmins(miembros, usuario_id)) throw new ErrorEquipo(409, MENSAJE_ULTIMO_ADMIN);
  return m;
}
