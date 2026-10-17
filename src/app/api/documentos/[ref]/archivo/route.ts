import { conRol } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";

import { error, manejar } from "../../../_http";
import { PANEL } from "../../../_identidad";

/**
 * GET /api/documentos/:ref/archivo (§12): el archivo original tal como llegó.
 * `?adjunto=0` devuelve el adjunto n.º 0 (el PDF dentro de un correo).
 * Panel: cualquier documento. Proveedor: solo los que subió él por el portal; los demás dan 404
 * (no se confirma que exista una ref ajena).
 */
export const GET = conRol([...PANEL, "proveedor"], async (req: Request, ctx: RouteContext<"/api/documentos/[ref]/archivo">, sesion) => {
  try {
    const { ref } = await ctx.params;
    const repo = await obtenerRepositorio();
    if (sesion.rol === "proveedor") {
      const doc = await repo.documento(ref);
      const suyo = doc?.remitente.tipo === "portal" && doc.beneficiario_remitente_id !== null && doc.beneficiario_remitente_id === sesion.beneficiario_id;
      if (!suyo) return error(404, `No hay archivo para ${ref}.`);
    }
    const adjunto = new URL(req.url).searchParams.get("adjunto");
    const indice = adjunto === null ? null : Number(adjunto);
    if (indice !== null && !(Number.isInteger(indice) && indice >= 0)) return error(400, "adjunto debe ser un número ≥ 0.");
    const archivo = indice === null ? await repo.leerArchivo(ref) : await repo.leerAdjunto(ref, indice);
    if (!archivo) return error(404, `No hay archivo para ${ref}.`);
    // Se muestra en el navegador (iframe del visor), nunca se ejecuta: sin sniffing y con CSP que bloquea scripts.
    // `sandbox` se omite en PDF e imágenes: Chrome no abre su visor de PDF dentro de un documento aislado.
    // Cualquier otro tipo (XML, correo, texto) se descarga en vez de mostrarse.
    const visor = archivo.mime === "application/pdf" || archivo.mime.startsWith("image/");
    const nombre = archivo.nombre.replaceAll(/[^\w.-]/g, "_");
    return new Response(new Uint8Array(archivo.bytes), {
      headers: {
        "content-type": archivo.mime,
        "content-disposition": `${visor ? "inline" : "attachment"}; filename="${nombre}"`,
        "x-content-type-options": "nosniff",
        "content-security-policy": `default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'${visor ? "" : "; sandbox"}`,
        "cache-control": "private, max-age=300",
      },
    });
  } catch (e) {
    return manejar(e);
  }
});
