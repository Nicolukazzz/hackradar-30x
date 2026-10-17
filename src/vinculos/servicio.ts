// Casos de uso de los enlaces de proveedor (#85). Las rutas y páginas solo verifican la sesión (o el token) y llaman
// aquí. Quién crea sale de la sesión; el correo lo escribe el proveedor en la página pública del enlace.

import { z } from "zod";

import { generarToken, hashToken, pareceToken } from "@/equipo/token";
import type { Sesion } from "@/lib/auth/permisos";
import { urlPublica } from "@/lib/url-publica";
import { duenoDelCorreo } from "@/repositorio/comun";
import type { Repositorio } from "@/repositorio/repositorio";

import type { AlmacenEnlaces } from "./almacen";
import { EsquemaNuevoEnlace, EsquemaUsoEnlace, estadoEnlace, generarConexionId, VIGENCIA_DIAS, venceEn } from "./reglas";
import { ErrorVinculo, MENSAJE_CORREO_OCUPADO, MENSAJE_INVALIDO, type EnlaceProveedor, type EstadoEnlace } from "./tipos";

export type EnlaceConEstado = EnlaceProveedor & { estado: EstadoEnlace };

/** Lo que ve el proveedor al abrir el enlace: nada de reglas, montos ni otros proveedores. */
export type VistaEnlace = { nombre: string; existente: boolean; empresa: string };

export type Vinculado = { nombre: string; existente: boolean; correo: string; conexion_id: string };

function validar<T extends z.ZodType>(esquema: T, entrada: unknown): z.output<T> {
  const r = esquema.safeParse(entrada);
  if (!r.success) throw new ErrorVinculo(400, z.prettifyError(r.error));
  return r.data;
}

export async function listarEnlaces(almacen: AlmacenEnlaces, ahora: string): Promise<EnlaceConEstado[]> {
  return (await almacen.listar()).map((e) => ({ ...e, estado: estadoEnlace(e, ahora) }));
}

/**
 * Crea el enlace para un beneficiario de la lista (`{ beneficiario_id }`) o para un proveedor nuevo (`{ nombre }`).
 * El token en claro existe solo en esta respuesta (en la base queda su hash).
 */
export async function crearEnlace(
  almacen: AlmacenEnlaces,
  repo: Repositorio,
  autor: Pick<Sesion, "usuario_id">,
  entrada: unknown,
  ahora: string,
): Promise<{ enlace: EnlaceConEstado; url: string }> {
  const v = validar(EsquemaNuevoEnlace, entrada);
  let beneficiario_id: string | null = null;
  let nombre: string;
  if ("beneficiario_id" in v) {
    const b = (await repo.datosComunes()).beneficiarios.find((x) => x.id === v.beneficiario_id);
    if (!b || b.estado !== "activo") throw new ErrorVinculo(404, "Ese proveedor no está en la lista permitida.");
    beneficiario_id = b.id;
    nombre = b.nombre;
  } else {
    nombre = v.nombre;
  }
  const token = generarToken();
  const enlace = await almacen.crear({
    token_hash: hashToken(token),
    beneficiario_id,
    nombre,
    creado_por: autor.usuario_id,
    creado_en: new Date(Date.parse(ahora)).toISOString(),
    expira_en: venceEn(ahora, VIGENCIA_DIAS),
  });
  return { enlace: { ...enlace, estado: "activo" }, url: urlPublica(`/vincular/${token}`) };
}

export async function revocarEnlace(almacen: AlmacenEnlaces, id: string, ahora: string): Promise<void> {
  if (!z.uuid().safeParse(id).success || !(await almacen.revocar(id, ahora))) throw new ErrorVinculo(404, "No hay un enlace activo con ese id.");
}

async function activo(almacen: AlmacenEnlaces, token: string, ahora: string): Promise<EnlaceProveedor | null> {
  if (!pareceToken(token)) return null;
  const e = await almacen.porHash(hashToken(token));
  return e && estadoEnlace(e, ahora) === "activo" ? e : null;
}

/** Lo que ve quien abre el enlace. null = no sirve (no se dice por qué). */
export async function vistaEnlace(almacen: AlmacenEnlaces, repo: Repositorio, token: string, ahora: string): Promise<VistaEnlace | null> {
  const e = await activo(almacen, token, ahora);
  if (!e) return null;
  return { nombre: e.nombre, existente: e.beneficiario_id !== null, empresa: (await repo.datosComunes()).empresa.nombre };
}

/**
 * El proveedor escribe su correo de facturación. Se usa el enlace (atómico, un solo uso), se genera el id de conexión,
 * se vincula el correo si el enlace es de un beneficiario de la lista y queda una entrada CAMBIO_BENEFICIARIOS en el
 * registro. Un correo que ya es de otro proveedor se rechaza sin gastar el enlace.
 */
export async function usarEnlace(almacen: AlmacenEnlaces, repo: Repositorio, token: string, entrada: unknown, ahora: string): Promise<Vinculado> {
  const { correo } = validar(EsquemaUsoEnlace, entrada);
  return repo.enExclusiva(async () => {
    const e = await activo(almacen, token, ahora);
    if (!e) throw new ErrorVinculo(404, MENSAJE_INVALIDO);
    const dueno = duenoDelCorreo((await repo.datosComunes()).beneficiarios, correo);
    // Un proveedor nuevo con el correo de uno de la lista tampoco: sería pasar por otro.
    if (dueno && dueno.id !== e.beneficiario_id) throw new ErrorVinculo(409, MENSAJE_CORREO_OCUPADO);

    const usado = await almacen.usar(hashToken(token), correo, generarConexionId(), ahora);
    if (!usado?.conexion_id) throw new ErrorVinculo(404, MENSAJE_INVALIDO);
    const conexion_id = usado.conexion_id;
    if (e.beneficiario_id) await repo.vincularCorreo(e.beneficiario_id, correo);

    const explicacion = e.beneficiario_id
      ? `${e.nombre} vinculó el correo ${correo} con un enlace creado por la empresa (conexión ${conexion_id}). Sus facturas desde ese correo cumplen R11.`
      : `${e.nombre}, proveedor nuevo, registró el correo ${correo} con un enlace creado por la empresa (conexión ${conexion_id}). No está en la lista permitida: sus facturas se escalan (R3) hasta que una persona lo agregue.`;
    // Append-only: quién vinculó qué correo y con qué conexión.
    await repo.agregarEntrada({
      id: await repo.siguienteIdRegistro(Number(ahora.slice(0, 4))),
      momento: ahora,
      actor: { tipo: "agente" },
      tipo: "CAMBIO_BENEFICIARIOS",
      ref_interna: `CANAL-CORREO-${conexion_id}`,
      factura_numero: null,
      beneficiario: e.nombre,
      canal: "correo",
      formato: "correo",
      monto_original: null,
      monto_usd_centavos: null,
      tasa_usada: null,
      decision: null,
      reglas_version: (await repo.reglasVigentes()).version,
      evaluaciones: [],
      reglas_que_fallaron: [],
      comparaciones: [],
      explicacion,
      comentario: null,
      entrada_origen: null,
      extraccion: null,
      sha256: hashToken(token),
    });
    return { nombre: e.nombre, existente: e.beneficiario_id !== null, correo, conexion_id };
  });
}
