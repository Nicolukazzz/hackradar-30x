// Casos de uso de las invitaciones de proveedor (#28). Las rutas y páginas solo verifican la sesión y llaman
// aquí. Quién crea, quién envía y con qué correo salen siempre de la sesión.

import { z } from "zod";

import { decisionAgente, estadoHumano } from "@/aprobaciones/decidir";
import type { DecisionAgente, EntradaRegistro } from "@/dominio/tipos";
import { generarToken, hashToken, pareceToken } from "@/equipo/token";
import { validarArchivo } from "@/ingesta/validar-archivo";
import type { Sesion } from "@/lib/auth/permisos";
import { urlPublica } from "@/lib/url-publica";
import type { Repositorio } from "@/repositorio/repositorio";
import { type DependenciasSubida, ErrorSubida, subirDocumento } from "@/servicios/subida";

import type { AlmacenInvitaciones } from "./almacen";
import { EsquemaNuevaInvitacionProveedor, estadoInvitacion, remitenteInvitacion, venceEn } from "./reglas";
import { ErrorInvitacion, MENSAJE_INVALIDA, type EstadoInvitacionProveedor, type InvitacionProveedor } from "./tipos";

export type InvitacionConEstado = InvitacionProveedor & { estado: EstadoInvitacionProveedor };

/** Lo que ve el proveedor de cada envío: sin reglas, límites ni montos de la empresa (como `respuesta.ts`). */
export type EstadoEnvio = "en_revision" | "aprobada" | "no_se_pagara" | "no_es_factura";

export type Envio = { ref_interna: string; recibido_en: string; nombre_archivo: string; estado: EstadoEnvio; mensaje: string };

export async function listarInvitaciones(almacen: AlmacenInvitaciones, ahora: string): Promise<InvitacionConEstado[]> {
  return (await almacen.listar()).map((i) => ({ ...i, estado: estadoInvitacion(i, ahora) }));
}

/** Crea el enlace. El token en claro existe solo en esta respuesta (en la base queda su hash). */
export async function crearInvitacion(
  almacen: AlmacenInvitaciones,
  autor: Pick<Sesion, "usuario_id">,
  entrada: unknown,
  ahora: string,
): Promise<{ invitacion: InvitacionConEstado; enlace: string }> {
  const r = EsquemaNuevaInvitacionProveedor.safeParse(entrada);
  if (!r.success) throw new ErrorInvitacion(400, z.prettifyError(r.error));
  const v = r.data;
  const token = generarToken();
  const invitacion = await almacen.crear({
    token_hash: hashToken(token),
    nombre_esperado: v.nombre_esperado,
    correo_esperado: v.correo_esperado,
    creada_por: autor.usuario_id,
    creada_en: new Date(Date.parse(ahora)).toISOString(),
    expira_en: venceEn(ahora, v.dias_vigencia),
    usos_max: v.usos_max,
  });
  return { invitacion: { ...invitacion, estado: "activa" }, enlace: urlPublica(`/enviar/${token}`) };
}

export async function revocarInvitacion(almacen: AlmacenInvitaciones, id: string, ahora: string): Promise<void> {
  if (!z.uuid().safeParse(id).success || !(await almacen.revocar(id, ahora))) throw new ErrorInvitacion(404, "No hay una invitación activa con ese id.");
}

/** Lo que ve quien abre el enlace. null = no sirve (no se dice por qué). */
export async function vistaInvitacion(almacen: AlmacenInvitaciones, token: string, ahora: string): Promise<InvitacionProveedor | null> {
  if (!pareceToken(token)) return null;
  const inv = await almacen.porHash(hashToken(token));
  return inv && estadoInvitacion(inv, ahora) === "activa" ? inv : null;
}

function estadoEnvio(registro: readonly EntradaRegistro[], ref: string): { estado: EstadoEnvio; mensaje: string } {
  const agente = decisionAgente(registro, ref);
  if (!agente) return { estado: "en_revision", mensaje: "Recibida. El agente todavía no la revisa." };
  const final = estadoHumano(registro, agente).final;
  if (final?.decision === "APROBADA_HUMANO") return { estado: "aprobada", mensaje: "Aprobada por el equipo de finanzas." };
  if (final?.decision === "RECHAZADA_HUMANO") return { estado: "no_se_pagara", mensaje: "El equipo de finanzas decidió no pagarla. Te contactarán si necesitan algo." };
  const d = agente.decision as DecisionAgente;
  if (d === "RECHAZADA_NO_FACTURA") return { estado: "no_es_factura", mensaje: "El documento no parece una factura. Revisa el archivo y envíalo de nuevo." };
  // Remitente sin verificar (R11, siempre por enlace): no se confirma si la factura ya existía, como en respuesta.ts.
  const verificado = !agente.reglas_que_fallaron.includes("R11");
  if (d === "FRENAR" && verificado && agente.reglas_que_fallaron.includes("R2")) return { estado: "no_se_pagara", mensaje: "Esta factura ya la habíamos recibido: no se paga dos veces." };
  if (d === "FRENAR") return { estado: "no_se_pagara", mensaje: "No se puede pagar así. El equipo de finanzas te contactará." };
  // ESCALAR (siempre, por R11) o, por si acaso, cualquier otra cosa: una persona la revisa.
  return { estado: "en_revision", mensaje: "En revisión: una persona del equipo de finanzas la revisará." };
}

/**
 * Envía una factura por el enlace. Valida el archivo antes de gastar un uso, cuenta el uso de forma atómica y la
 * pasa por la ingesta única con remitente `invitacion:<id>:<correo>`: R11 nunca lo verifica, así que se escala.
 */
export async function enviarPorInvitacion(
  almacen: AlmacenInvitaciones,
  token: string,
  sesion: Pick<Sesion, "usuario_id" | "correo" | "nombre" | "rol" | "limite_aprobacion_usd">,
  archivo: { bytes: Uint8Array; nombre: string },
  deps: DependenciasSubida,
): Promise<Envio> {
  if (!pareceToken(token)) throw new ErrorInvitacion(404, MENSAJE_INVALIDA);
  const v = validarArchivo(archivo.bytes);
  if (!v.ok) throw new ErrorSubida(v.estado, v.mensaje);
  const uso = await almacen.usar(hashToken(token), sesion.correo, deps.ahora);
  if (uso.resultado === "otro_correo") throw new ErrorInvitacion(403, "Este enlace es para otra cuenta. Sal y entra con el correo al que te lo enviaron.");
  if (uso.resultado !== "ok" || !uso.invitacion) throw new ErrorInvitacion(404, MENSAJE_INVALIDA);
  const r = await subirDocumento(archivo, sesion, deps, {
    canal: "portal",
    remitente: { tipo: "portal", valor: remitenteInvitacion(uso.invitacion.id, sesion.correo) },
  });
  const e = estadoEnvio(await deps.repo.registro({ ref_interna: r.ref_interna }), r.ref_interna);
  return { ref_interna: r.ref_interna, recibido_en: deps.ahora, nombre_archivo: archivo.nombre, ...e };
}

/** Lo que esta cuenta envió con esta invitación, lo más nuevo primero. */
export async function misEnvios(repo: Repositorio, invitacion_id: string, correo: string): Promise<Envio[]> {
  const remitente = remitenteInvitacion(invitacion_id, correo);
  const [documentos, registro] = await Promise.all([repo.documentos(), repo.registro()]);
  return documentos
    .filter((d) => d.remitente.tipo === "portal" && d.remitente.valor === remitente)
    .sort((a, b) => Date.parse(b.recibido_en) - Date.parse(a.recibido_en))
    .map((d) => ({ ref_interna: d.ref_interna, recibido_en: d.recibido_en, nombre_archivo: d.adjuntos[0]?.nombre ?? "documento", ...estadoEnvio(registro, d.ref_interna) }));
}
