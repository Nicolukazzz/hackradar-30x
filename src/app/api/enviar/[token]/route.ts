import { dependenciasCanal } from "@/canales/dependencias";
import { MAX_BYTES } from "@/ingesta/limites";
import { obtenerAlmacenInvitaciones } from "@/invitaciones";
import { enviarPorInvitacion } from "@/invitaciones/servicio";
import { MENSAJE_401 } from "@/lib/auth/permisos";
import { obtenerSesion } from "@/lib/auth/sesion";
import { crearLimitador } from "@/lib/limite";
import { obtenerRepositorio } from "@/repositorio";
import { ErrorSubida } from "@/servicios/subida";

import { cuerpoLimitado } from "../../_cuerpo";
import { error, manejar, ok } from "../../_http";

// POST /api/enviar/:token (#28): un proveedor nuevo sube su factura con el enlace de invitación. Está en
// API_PUBLICAS porque quien sube NO es miembro de la empresa (`conSesion` exige membresía), pero igual exige
// sesión (correo confirmado al crear la cuenta) y mismo origen. El remitente lo arma el servidor:
// `invitacion:<id>:<correo de la sesión>`; R11 nunca lo verifica, así que todo lo que entra aquí escala.

const MAX_CUERPO = MAX_BYTES + 64 * 1024;
const porMinuto = crearLimitador({ maximo: 5, ventanaMs: 60_000 });
const porDia = crearLimitador({ maximo: 20, ventanaMs: 24 * 60 * 60 * 1000 });

function mismoOrigen(req: Request): boolean {
  const origen = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  try {
    return origen !== null && new URL(origen).host === host;
  } catch {
    return false;
  }
}

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

export async function POST(req: Request, ctx: RouteContext<"/api/enviar/[token]">): Promise<Response> {
  try {
    if (!mismoOrigen(req)) return error(403, "No tienes permiso para esta acción.");
    const sesion = await obtenerSesion();
    if (!sesion) return error(401, MENSAJE_401);
    if (!porMinuto.permitir(sesion.usuario_id) || !porDia.permitir(sesion.usuario_id)) throw new ErrorSubida(429, "Demasiados envíos seguidos. Espera un momento.");
    const { token } = await ctx.params;
    const archivo = await archivoDe(req);
    const r = await enviarPorInvitacion(await obtenerAlmacenInvitaciones(), token, sesion, archivo, await dependenciasCanal(await obtenerRepositorio()));
    return ok(r, { status: 201 });
  } catch (e) {
    return manejar(e);
  }
}
