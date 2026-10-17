// Dependencias comunes de los canales (portal, correo): hora de la decisión, extractor real y enlace al portal.
// Un solo lugar: si cambia cómo se elige el LLM o la URL pública, cambia para todos.

import { cacheEnDisco } from "@/extraccion/cache";
import { proveedorDesdeEntorno } from "@/extraccion/llm/proveedor";
import { type Extractor, extractorReal } from "@/ingesta/pipeline";
import { urlPublica } from "@/lib/url-publica";
import type { Repositorio } from "@/repositorio/repositorio";
import { ahoraHumano } from "@/servicios/comun";

export async function dependenciasCanal(repo: Repositorio): Promise<{ repo: Repositorio; ahora: string; extractor: Extractor; urlPortal: string }> {
  return {
    repo,
    ahora: await ahoraHumano(repo),
    extractor: extractorReal({ llm: proveedorDesdeEntorno(), cache: cacheEnDisco() }),
    urlPortal: urlPublica("/portal"),
  };
}
