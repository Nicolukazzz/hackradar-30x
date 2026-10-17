import { dependenciasCanal } from "@/canales/dependencias";
import { MAX_BYTES } from "@/ingesta/limites";
import { crearLimitador } from "@/lib/limite";
import { conRol } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { ErrorSubida, subirDocumento } from "@/servicios/subida";

import { cuerpoLimitado } from "../_cuerpo";
import { manejar, ok } from "../_http";
import { PANEL } from "../_identidad";

/** Margen para las cabeceras del multipart sobre los 10 MB del archivo. */
const MAX_CUERPO = MAX_BYTES + 64 * 1024;
const limitador = crearLimitador({ maximo: 20, ventanaMs: 60_000 });

/** Exactamente un archivo, en el campo `archivo`. */
async function archivoDe(req: Request): Promise<{ bytes: Uint8Array; nombre: string }> {
  const tipo = req.headers.get("content-type") ?? "";
  if (!tipo.startsWith("multipart/form-data")) throw new ErrorSubida(400, "Envía el archivo como multipart/form-data.");
  const formulario = await new Response(await cuerpoLimitado(req, MAX_CUERPO, "El archivo supera los 10 MB."), { headers: { "content-type": tipo } }).formData().catch(() => {
    throw new ErrorSubida(400, "No se pudo leer el formulario.");
  });
  const archivos = [...formulario.values()].filter((v): v is File => typeof v !== "string");
  const archivo = formulario.get("archivo");
  if (archivos.length !== 1 || typeof archivo === "string" || archivo === null) {
    throw new ErrorSubida(400, "Envía un solo archivo en el campo «archivo».");
  }
  return { bytes: new Uint8Array(await archivo.arrayBuffer()), nombre: archivo.name };
}

/**
 * POST /api/documentos (#26): sube una factura (PDF, PNG, JPG o XML, ≤ 10 MB) desde el portal (proveedor)
 * o el panel (carga manual). El remitente sale de la sesión. Devuelve la ref interna, la decisión y el aviso.
 */
export const POST = conRol([...PANEL, "proveedor"], async (req: Request, _ctx, sesion) => {
  try {
    if (!limitador.permitir(sesion.usuario_id)) throw new ErrorSubida(429, "Demasiadas subidas seguidas. Espera un minuto.");
    const archivo = await archivoDe(req);
    const r = await subirDocumento(archivo, sesion, await dependenciasCanal(await obtenerRepositorio()));
    return ok(r, { status: 201 });
  } catch (e) {
    return manejar(e);
  }
});
