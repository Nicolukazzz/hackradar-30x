// Casos de uso del portal del proveedor (#85). Las rutas y páginas solo verifican la sesión (admin) o la cookie del
// proveedor y llaman aquí.

import { z } from "zod";

import { decisionAgente, estadoHumano } from "@/aprobaciones/decidir";
import type { DecisionAgente, EntradaRegistro } from "@/dominio/tipos";
import { generarToken, pareceToken } from "@/equipo/token";
import type { Sesion } from "@/lib/auth/permisos";
import { urlPublica } from "@/lib/url-publica";
import type { Repositorio } from "@/repositorio/repositorio";
import { type DependenciasSubida, subirDocumento } from "@/servicios/subida";

import { hashesIguales, hashValor } from "./acceso";
import type { AlmacenEnlaces } from "./almacen";
import { formatearCodigo } from "./codigo";
import { EsquemaAcceso, EsquemaCambioCodigo, EsquemaNuevoEnlace, estadoEnlace, VIGENCIA_DIAS, venceEn } from "./reglas";
import {
  ErrorCodigoRepetido,
  ErrorVinculo,
  MENSAJE_INVALIDO,
  MENSAJE_NO_COINCIDE,
  type EnlaceConCodigo,
  type EnlaceProveedor,
  type EstadoEnlace,
} from "./tipos";

/** Enlace con su estado calculado al leerlo. */
export type EnlaceConEstado = EnlaceProveedor & { estado: EstadoEnlace };

/** Lo que ve el proveedor antes de entrar: solo el nombre de la empresa. */
export type VistaEnlace = { empresa: string };

/** Lo que ve el proveedor de cada factura: sin reglas, límites ni montos de la empresa (como `respuesta.ts`). */
export type EstadoEnvio = "en_revision" | "aprobada" | "no_se_pagara" | "no_es_factura";
/** Una factura que subió el proveedor, con el estado y el mensaje que se le muestran. */
export type Envio = { ref_interna: string; recibido_en: string; nombre_archivo: string; estado: EstadoEnvio; mensaje: string };

const hashCodigo = (codigo: string) => hashValor(`codigo:${codigo}`);
const hashToken = (token: string) => hashValor(token);

function validar<T extends z.ZodType>(esquema: T, entrada: unknown): z.output<T> {
  const r = esquema.safeParse(entrada);
  if (!r.success) throw new ErrorVinculo(400, z.prettifyError(r.error));
  return r.data;
}

/** Enlaces del portal, los más nuevos primero. */
export async function listarEnlaces(almacen: AlmacenEnlaces, ahora: string): Promise<EnlaceConEstado[]> {
  return (await almacen.listar()).map((e) => ({ ...e, estado: estadoEnlace(e, ahora) }));
}

/**
 * Crea el portal de un proveedor: `{ nombre, correo, codigo }` (el código lo genera la pantalla y el admin puede pedir
 * otro antes de crear). Devuelve la URL con el token en claro y el código formateado: los dos existen solo aquí.
 */
export async function crearEnlace(
  almacen: AlmacenEnlaces,
  repo: Repositorio,
  autor: Pick<Sesion, "usuario_id">,
  entrada: unknown,
  ahora: string,
): Promise<{ enlace: EnlaceConEstado; url: string; codigo: string }> {
  const v = validar(EsquemaNuevoEnlace, entrada);
  const dueno = (await repo.datosComunes()).beneficiarios.find((b) => b.estado === "activo" && b.canales.correos.some((c) => c.toLowerCase() === v.correo));
  const token = generarToken();
  try {
    const enlace = await almacen.crear({
      token_hash: hashToken(token),
      codigo_hash: hashCodigo(v.codigo),
      nombre: v.nombre,
      correo: v.correo,
      beneficiario_id: dueno?.id ?? null,
      creado_por: autor.usuario_id,
      creado_en: new Date(Date.parse(ahora)).toISOString(),
      expira_en: venceEn(ahora, VIGENCIA_DIAS),
    });
    return { enlace: { ...enlace, estado: "activo" }, url: urlPublica(`/vincular/${token}`), codigo: formatearCodigo(v.codigo) };
  } catch (e) {
    if (e instanceof ErrorCodigoRepetido) throw new ErrorVinculo(409, "Ese código ya lo tiene otro proveedor. Genera otro.");
    throw e;
  }
}

/** Revoca un enlace: deja de servir y cierra las sesiones abiertas. 404 si no está activo. */
export async function revocarEnlace(almacen: AlmacenEnlaces, id: string, ahora: string): Promise<void> {
  if (!z.uuid().safeParse(id).success || !(await almacen.revocar(id, ahora))) throw new ErrorVinculo(404, "No hay un enlace activo con ese id.");
}

/** Borra un enlace revocado o vencido para que no quede en la lista para siempre (#119). Uno activo hay que revocarlo antes. */
export async function borrarEnlace(almacen: AlmacenEnlaces, id: string, ahora: string): Promise<void> {
  if (!z.uuid().safeParse(id).success || !(await almacen.borrar(id, new Date(Date.parse(ahora)).toISOString()))) {
    throw new ErrorVinculo(404, "Solo se pueden borrar accesos revocados o vencidos.");
  }
}

/** Código nuevo para un enlace (el anterior deja de servir y cierra las sesiones abiertas). */
export async function cambiarCodigo(almacen: AlmacenEnlaces, id: string, entrada: unknown, ahora: string): Promise<{ codigo: string }> {
  const { codigo } = validar(EsquemaCambioCodigo, entrada);
  if (!z.uuid().safeParse(id).success) throw new ErrorVinculo(404, "No hay un enlace activo con ese id.");
  const e = await almacen.porId(id);
  if (!e || estadoEnlace(e, ahora) !== "activo") throw new ErrorVinculo(404, "No hay un enlace activo con ese id.");
  try {
    if (!(await almacen.cambiarCodigo(id, hashCodigo(codigo), ahora))) throw new ErrorVinculo(404, "No hay un enlace activo con ese id.");
  } catch (err) {
    if (err instanceof ErrorCodigoRepetido) throw new ErrorVinculo(409, "Ese código ya lo tiene otro proveedor. Genera otro.");
    throw err;
  }
  return { codigo: formatearCodigo(codigo) };
}

/** El enlace vigente de este token, o null (no se dice por qué). */
export async function enlaceActivo(almacen: AlmacenEnlaces, token: string, ahora: string): Promise<EnlaceConCodigo | null> {
  if (!pareceToken(token)) return null;
  const e = await almacen.porHash(hashToken(token));
  return e && estadoEnlace(e, ahora) === "activo" ? e : null;
}

/** Lo que el proveedor ve antes de entrar (el nombre de la empresa), o null si el enlace no sirve. */
export async function vistaEnlace(almacen: AlmacenEnlaces, repo: Repositorio, token: string, ahora: string): Promise<VistaEnlace | null> {
  return (await enlaceActivo(almacen, token, ahora)) ? { empresa: (await repo.datosComunes()).empresa.nombre } : null;
}

/** El proveedor escribe correo y código. Si los dos coinciden con lo que puso el admin, devuelve el enlace. */
export async function entrar(almacen: AlmacenEnlaces, token: string, entrada: unknown, ahora: string): Promise<EnlaceConCodigo> {
  const { correo, codigo } = validar(EsquemaAcceso, entrada);
  const e = await enlaceActivo(almacen, token, ahora);
  if (!e) throw new ErrorVinculo(404, MENSAJE_INVALIDO);
  // Se comparan los dos siempre: la respuesta no dice cuál falló.
  const correoOk = hashesIguales(hashValor(correo), hashValor(e.correo));
  const codigoOk = hashesIguales(hashCodigo(codigo), e.codigo_hash);
  if (!correoOk || !codigoOk) throw new ErrorVinculo(401, MENSAJE_NO_COINCIDE);
  await almacen.registrarAcceso(e.id, ahora);
  return e;
}

function estadoEnvio(registro: readonly EntradaRegistro[], ref: string): { estado: EstadoEnvio; mensaje: string } {
  const agente = decisionAgente(registro, ref);
  if (!agente) return { estado: "en_revision", mensaje: "Recibida. El agente todavía no la revisa." };
  const final = estadoHumano(registro, agente).final;
  if (final?.decision === "APROBADA_HUMANO") return { estado: "aprobada", mensaje: "Aprobada por el equipo de finanzas." };
  if (final?.decision === "RECHAZADA_HUMANO") return { estado: "no_se_pagara", mensaje: "El equipo de finanzas decidió no pagarla. Te contactarán si necesitan algo." };
  const d = agente.decision as DecisionAgente;
  if (d === "PAGAR") return { estado: "aprobada", mensaje: "Aprobada para pago." };
  if (d === "RECHAZADA_NO_FACTURA") return { estado: "no_es_factura", mensaje: "El documento no parece una factura. Revisa el archivo y envíalo de nuevo." };
  // Remitente sin verificar (R11): no se confirma si la factura ya existía, como en respuesta.ts.
  const verificado = !agente.reglas_que_fallaron.includes("R11");
  if (d === "FRENAR" && verificado && agente.reglas_que_fallaron.includes("R2")) return { estado: "no_se_pagara", mensaje: "Esta factura ya la habíamos recibido: no se paga dos veces." };
  if (d === "FRENAR") return { estado: "no_se_pagara", mensaje: "No se puede pagar así. El equipo de finanzas te contactará." };
  return { estado: "en_revision", mensaje: "En revisión: una persona del equipo de finanzas la revisará." };
}

/** Remitente de lo que sube el proveedor: el correo que puso el admin. R11 cumple solo si ya es canal del beneficiario. */
function origen(e: EnlaceProveedor) {
  return { canal: "portal" as const, remitente: { tipo: "correo" as const, valor: e.correo } };
}

/** Sube una factura desde el portal (ya con la cookie verificada) por la ingesta única y el motor. */
export async function enviarFactura(e: EnlaceProveedor, archivo: { bytes: Uint8Array; nombre: string }, deps: DependenciasSubida): Promise<Envio> {
  const sesion: Sesion = { usuario_id: `proveedor:${e.id}`, correo: e.correo, nombre: e.nombre, rol: null, limite_aprobacion_usd: null };
  const r = await subirDocumento(archivo, sesion, deps, origen(e));
  const estado = estadoEnvio(await deps.repo.registro({ ref_interna: r.ref_interna }), r.ref_interna);
  return { ref_interna: r.ref_interna, recibido_en: deps.ahora, nombre_archivo: archivo.nombre, ...estado };
}

/** Lo que este proveedor subió por el portal, lo más nuevo primero. */
export async function misEnvios(repo: Repositorio, e: EnlaceProveedor): Promise<Envio[]> {
  const { canal, remitente } = origen(e);
  const [documentos, registro] = await Promise.all([repo.documentos(), repo.registro()]);
  return documentos
    .filter((d) => d.canal === canal && d.remitente.tipo === remitente.tipo && d.remitente.valor.toLowerCase() === remitente.valor)
    .sort((a, b) => Date.parse(b.recibido_en) - Date.parse(a.recibido_en))
    .map((d) => ({ ref_interna: d.ref_interna, recibido_en: d.recibido_en, nombre_archivo: d.adjuntos[0]?.nombre ?? "documento", ...estadoEnvio(registro, d.ref_interna) }));
}
