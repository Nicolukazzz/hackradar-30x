import { cacheEnDisco } from "@/extraccion/cache";
import { proveedorDesdeEntorno } from "@/extraccion/llm/proveedor";
import { extractorReal } from "@/ingesta/pipeline";
import { MAX_BYTES } from "@/ingesta/limites";
import { crearLimitador } from "@/lib/limite";
import { conRol } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { ahoraHumano } from "@/servicios/comun";
import { ErrorSubida, subirDocumento } from "@/servicios/subida";

import { manejar, ok } from "../_http";
import { PANEL } from "../_identidad";

/** Margen para las cabeceras del multipart sobre los 10 MB del archivo. */
const MAX_CUERPO = MAX_BYTES + 64 * 1024;
const limitador = crearLimitador({ maximo: 20, ventanaMs: 60_000 });

/** Lee el cuerpo cortando apenas pasa el límite: nunca se carga en memoria un cuerpo gigante. */
async function cuerpoLimitado(req: Request): Promise<Buffer<ArrayBuffer>> {
  const declarado = Number(req.headers.get("content-length") ?? "0");
  if (declarado > MAX_CUERPO) throw new ErrorSubida(413, "El archivo supera los 10 MB.");
  if (!req.body) throw new ErrorSubida(400, "Falta el archivo.");
  const partes: Uint8Array[] = [];
  let total = 0;
  const lector = req.body.getReader();
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_CUERPO) {
      await lector.cancel();
      throw new ErrorSubida(413, "El archivo supera los 10 MB.");
    }
    partes.push(value);
  }
  return Buffer.concat(partes);
}

/** Exactamente un archivo, en el campo `archivo`. */
async function archivoDe(req: Request): Promise<{ bytes: Uint8Array; nombre: string }> {
  const tipo = req.headers.get("content-type") ?? "";
  if (!tipo.startsWith("multipart/form-data")) throw new ErrorSubida(400, "Envía el archivo como multipart/form-data.");
  const formulario = await new Response(await cuerpoLimitado(req), { headers: { "content-type": tipo } }).formData().catch(() => {
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
    const repo = await obtenerRepositorio();
    const extractor = extractorReal({ llm: proveedorDesdeEntorno(), cache: cacheEnDisco() });
    const r = await subirDocumento(archivo, sesion, {
      repo,
      ahora: await ahoraHumano(repo),
      extractor,
      urlPortal: new URL("/portal", req.url).toString(),
    });
    return ok(r, { status: 201 });
  } catch (e) {
    return manejar(e);
  }
});
