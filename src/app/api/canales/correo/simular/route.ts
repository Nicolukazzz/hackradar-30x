import { recibirCorreo } from "@/canales/correo/recibir";
import { cacheEnDisco } from "@/extraccion/cache";
import { proveedorDesdeEntorno } from "@/extraccion/llm/proveedor";
import { MAX_BYTES } from "@/ingesta/limites";
import { extractorReal } from "@/ingesta/pipeline";
import { conRol } from "@/lib/auth/ruta";
import { urlPublica } from "@/lib/url-publica";
import { obtenerRepositorio } from "@/repositorio";
import { ahoraHumano } from "@/servicios/comun";

import { error, manejar, ok } from "../../../_http";
import { PANEL } from "../../../_identidad";

/**
 * POST /api/canales/correo/simular (#14): recibe un .eml crudo (cuerpo `message/rfc822`) como si hubiera
 * llegado al buzón. Para la demo sin internet y para probar con los .eml del dataset. No envía la respuesta:
 * la devuelve para mostrarla.
 */
export const POST = conRol(PANEL, async (req: Request) => {
  try {
    const eml = Buffer.from(await req.arrayBuffer());
    if (eml.byteLength === 0) return error(400, "Envía el correo .eml en el cuerpo.");
    if (eml.byteLength > MAX_BYTES) return error(413, "El correo supera los 10 MB.");
    const repo = await obtenerRepositorio();
    const extractor = extractorReal({ llm: proveedorDesdeEntorno(), cache: cacheEnDisco() });
    const r = await recibirCorreo(eml, { repo, ahora: await ahoraHumano(repo), extractor, urlPortal: urlPublica("/portal") });
    return ok(
      {
        ref_interna: r.entrada.ref_interna,
        estado: r.entrada.decision,
        reglas_que_fallaron: r.entrada.reglas_que_fallaron,
        explicacion: r.entrada.explicacion,
        respuesta: r.respuesta,
      },
      { status: 201 },
    );
  } catch (e) {
    return manejar(e);
  }
});
