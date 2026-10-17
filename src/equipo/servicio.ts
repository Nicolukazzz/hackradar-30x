// Casos de uso del equipo (#51). Las rutas de /api/equipo y la página /unirse solo validan permisos (conSesion)
// y llaman aquí. Quién actúa sale siempre de la sesión.

import { z } from "zod";

import { rolPuede, type Sesion } from "@/lib/auth/permisos";
import { urlPublica } from "@/lib/url-publica";

import type { AlmacenEquipo } from "./almacen";
import { EsquemaCambioMiembro, EsquemaNuevaInvitacion, estadoInvitacion, validarCambio, validarQuitar, venceEn } from "./reglas";
import { generarToken, hashToken, pareceToken } from "./token";
import { EMPRESA_ID, ErrorEquipo, type EstadoInvitacion, type Invitacion, type Miembro, type ResultadoAceptar } from "./tipos";

export type InvitacionConEstado = Invitacion & { estado: EstadoInvitacion };
export type Equipo = { miembros: Miembro[]; invitaciones: InvitacionConEstado[] };

function validar<T>(esquema: z.ZodType<T, unknown>, datos: unknown): T {
  const r = esquema.safeParse(datos);
  if (!r.success) throw new ErrorEquipo(400, z.prettifyError(r.error));
  return r.data;
}

export async function obtenerEquipo(almacen: AlmacenEquipo, ahora: string): Promise<Equipo> {
  const [miembros, invitaciones] = await Promise.all([almacen.miembros(EMPRESA_ID), almacen.invitaciones(EMPRESA_ID)]);
  return { miembros, invitaciones: invitaciones.map((i) => ({ ...i, estado: estadoInvitacion(i, ahora) })) };
}

/**
 * Crea una invitación de un solo uso. Devuelve el enlace con el token en claro: es la única vez que existe
 * (en la base queda su hash), así que quien invita debe copiarlo ahora.
 */
export async function invitar(
  almacen: AlmacenEquipo,
  autor: Sesion,
  entrada: unknown,
  ahora: string,
): Promise<{ invitacion: InvitacionConEstado; enlace: string }> {
  const v = validar(EsquemaNuevaInvitacion, entrada);
  const token = generarToken();
  const creada_en = new Date(Date.parse(ahora)).toISOString();
  const invitacion = await almacen.crearInvitacion(EMPRESA_ID, {
    token_hash: hashToken(token),
    rol: v.rol,
    limite_aprobacion_usd: v.limite_aprobacion_usd,
    correo_esperado: v.correo_esperado,
    creada_por: autor.usuario_id,
    creada_en,
    expira_en: venceEn(ahora, v.dias_vigencia),
    usos_max: 1,
  });
  return { invitacion: { ...invitacion, estado: "activa" }, enlace: urlPublica(`/unirse/${token}`) };
}

export async function revocar(almacen: AlmacenEquipo, id: string, ahora: string): Promise<void> {
  if (!z.uuid().safeParse(id).success || !(await almacen.revocarInvitacion(EMPRESA_ID, id, ahora))) {
    throw new ErrorEquipo(404, "No hay una invitación activa con ese id.");
  }
}

export async function cambiarMiembro(almacen: AlmacenEquipo, usuario_id: string, entrada: unknown): Promise<Miembro> {
  const cambio = validar(EsquemaCambioMiembro, entrada);
  const m = validarCambio(await almacen.miembros(EMPRESA_ID), usuario_id, cambio);
  await almacen.cambiarMiembro(EMPRESA_ID, usuario_id, cambio.rol, cambio.limite_aprobacion_usd);
  return { ...m, ...cambio };
}

export async function quitarMiembro(almacen: AlmacenEquipo, usuario_id: string): Promise<void> {
  validarQuitar(await almacen.miembros(EMPRESA_ID), usuario_id);
  await almacen.quitarMiembro(EMPRESA_ID, usuario_id);
}

/** Lo que ve quien abre el enlace. null = no sirve (inexistente, vencida, revocada o usada: no se dice cuál). */
export async function vistaInvitacion(
  almacen: AlmacenEquipo,
  token: string,
  ahora: string,
): Promise<Pick<Invitacion, "rol" | "limite_aprobacion_usd" | "expira_en"> | null> {
  if (!pareceToken(token)) return null;
  const inv = await almacen.invitacionPorHash(EMPRESA_ID, hashToken(token));
  if (!inv || estadoInvitacion(inv, ahora) !== "activa") return null;
  return { rol: inv.rol, limite_aprobacion_usd: inv.limite_aprobacion_usd, expira_en: inv.expira_en };
}

export async function aceptar(almacen: AlmacenEquipo, token: string, sesion: Sesion): Promise<ResultadoAceptar> {
  if (!pareceToken(token)) return "invalida";
  return almacen.aceptarInvitacion(hashToken(token), sesion.usuario_id, sesion.correo);
}

/** Miembros que hoy pueden firmar una aprobación (§10): rol con permiso y cuenta activa. */
export function firmantes(miembros: readonly Miembro[]): Miembro[] {
  return miembros.filter((m) => m.activo && rolPuede(m.rol, "aprobar"));
}
