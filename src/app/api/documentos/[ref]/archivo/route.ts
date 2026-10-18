import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";

import { error, manejar } from "../../../_http";

/**
 * GET /api/documentos/:ref/archivo (§12): el archivo original tal como llegó.
 * `?adjunto=0` devuelve el adjunto n.º 0 (el PDF dentro de un correo).
 * Cualquier miembro del panel (permiso «ver»). El proveedor ve sus facturas por su portal, no por esta ruta.
 */
// En línea solo PDF e imágenes raster: el tipo de un adjunto de correo lo escribe quien lo envía, y un SVG o HTML
// puede traer scripts (la CSP igual los bloquea; esto es una segunda barrera).
const EN_LINEA = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"]);

export const GET = conSesion(async (req: Request, ctx: RouteContext<"/api/documentos/[ref]/archivo">) => {
  try {
    const { ref } = await ctx.params;
    const repo = await obtenerRepositorio();
    const adjunto = new URL(req.url).searchParams.get("adjunto");
    const indice = adjunto === null ? null : Number(adjunto);
    if (indice !== null && !(Number.isInteger(indice) && indice >= 0)) return error(400, "adjunto debe ser un número ≥ 0.");
    const archivo = indice === null ? await repo.leerArchivo(ref) : await repo.leerAdjunto(ref, indice);
    if (!archivo) return error(404, `No hay archivo para ${ref}.`);
    // Se muestra en el navegador (iframe del visor), nunca se ejecuta: sin sniffing y con CSP que bloquea scripts.
    // `sandbox` se omite en PDF e imágenes: Chrome no abre su visor de PDF dentro de un documento aislado.
    // Cualquier otro tipo (XML, correo, texto) se descarga en vez de mostrarse.
    const visor = EN_LINEA.has(archivo.mime.toLowerCase().split(";")[0]!.trim());
    const nombre = archivo.nombre.replaceAll(/[^\w.-]/g, "_");
    return new Response(new Uint8Array(archivo.bytes), {
      headers: {
        "content-type": archivo.mime,
        "content-disposition": `${visor ? "inline" : "attachment"}; filename="${nombre}"`,
        "x-content-type-options": "nosniff",
        "content-security-policy": `default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; frame-ancestors 'self'${visor ? "" : "; sandbox"}`,
        "cache-control": "private, max-age=300",
      },
    });
  } catch (e) {
    return manejar(e);
  }
});
