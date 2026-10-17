import { obtenerRepositorio } from "@/repositorio";

import { error, manejar } from "../../../_http";

/**
 * GET /api/documentos/:ref/archivo (§12): el archivo original tal como llegó.
 * `?adjunto=0` devuelve el adjunto n.º 0 (el PDF dentro de un correo).
 */
export async function GET(req: Request, ctx: RouteContext<"/api/documentos/[ref]/archivo">) {
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
    const visor = archivo.mime === "application/pdf" || archivo.mime.startsWith("image/");
    return new Response(new Uint8Array(archivo.bytes), {
      headers: {
        "content-type": archivo.mime,
        "content-disposition": `inline; filename="${archivo.nombre.replace(/[^\w.\-]/g, "_")}"`,
        "x-content-type-options": "nosniff",
        "content-security-policy": `default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'${visor ? "" : "; sandbox"}`,
        "cache-control": "private, max-age=300",
      },
    });
  } catch (e) {
    return manejar(e);
  }
}
