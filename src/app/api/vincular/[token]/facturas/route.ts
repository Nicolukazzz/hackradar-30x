import { cookies } from "next/headers";

import { dependenciasCanal } from "@/canales/dependencias";
import { MAX_BYTES } from "@/ingesta/limites";
import { mismoOrigen } from "@/lib/auth/guardia";
import { crearLimitador } from "@/lib/limite";
import { relojSistema } from "@/lib/reloj-sistema";
import { obtenerRepositorio } from "@/repositorio";
import { ErrorSubida } from "@/servicios/subida";
import { obtenerAlmacenEnlaces } from "@/vinculos";
import { COOKIE_PROVEEDOR, sesionValida } from "@/vinculos/acceso";
import { enlaceActivo, enviarFactura } from "@/vinculos/servicio";
import { MENSAJE_SIN_ACCESO } from "@/vinculos/tipos";

import { cuerpoLimitado } from "../../../_cuerpo";
import { error, manejar, ok } from "../../../_http";

// POST /api/vincular/:token/facturas (#85): el proveedor, con su cookie de sesión del portal, sube una factura
// (multipart, campo `archivo`, PDF o imagen ≤ 10 MB). Entra por la ingesta única con remitente = el correo del enlace
// y la decide el motor; el proveedor solo ve un estado sin reglas internas. Está en API_PUBLICAS (prefijo /api/vincular).

const MAX_CUERPO = MAX_BYTES + 64 * 1024;
const porMinuto = crearLimitador({ maximo: 20, ventanaMs: 60_000 }); // un envío de hasta 10 facturas cabe holgado
const porDia = crearLimitador({ maximo: 50, ventanaMs: 24 * 60 * 60 * 1000 });

async function archivoDe(req: Request): Promise<{ bytes: Uint8Array; nombre: string }> {
  const tipo = req.headers.get("content-type") ?? "";
  if (!tipo.startsWith("multipart/form-data")) throw new ErrorSubida(400, "Envía el archivo como multipart/form-data.");
  const formulario = await new Response(await cuerpoLimitado(req, MAX_CUERPO, "El archivo supera los 10 MB."), { headers: { "content-type": tipo } }).formData().catch(() => {
    throw new ErrorSubida(400, "No se pudo leer el formulario.");
  });
  const archivos = [...formulario.values()].filter((v): v is File => typeof v !== "string");
  const archivo = formulario.get("archivo");
  if (archivos.length !== 1 || typeof archivo === "string" || archivo === null) throw new ErrorSubida(400, "Envía un solo archivo en el campo «archivo».");
  return { bytes: new Uint8Array(await archivo.arrayBuffer()), nombre: archivo.name };
}

export async function POST(req: Request, ctx: RouteContext<"/api/vincular/[token]/facturas">): Promise<Response> {
  if (!mismoOrigen(req)) return error(403, "Origen no permitido.");
  try {
    const { token } = await ctx.params;
    const ahora = relojSistema().ahora();
    const enlace = await enlaceActivo(await obtenerAlmacenEnlaces(), token, ahora);
    if (!enlace || !sesionValida((await cookies()).get(COOKIE_PROVEEDOR)?.value, enlace.id, enlace.codigo_hash, ahora)) return error(401, MENSAJE_SIN_ACCESO);
    if (!porMinuto.permitir(enlace.id) || !porDia.permitir(enlace.id)) throw new ErrorSubida(429, "Demasiados envíos seguidos. Espera un momento.");
    const archivo = await archivoDe(req);
    const deps = await dependenciasCanal(await obtenerRepositorio());
    return ok(await enviarFactura(enlace, archivo, deps), { status: 201 });
  } catch (e) {
    return manejar(e);
  }
}
