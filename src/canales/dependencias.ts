// Dependencias comunes de los canales (portal, correo): hora de la decisión y extractor real.
// Un solo lugar: si cambia cómo se elige el LLM o la URL pública, cambia para todos.

import { cacheEnDisco } from "@/extraccion/cache";
import { proveedorDesdeEntorno } from "@/extraccion/llm/proveedor";
import { type Extractor, extractorReal } from "@/ingesta/pipeline";
import type { Repositorio } from "@/repositorio/repositorio";
import { ahoraHumano } from "@/servicios/comun";

/**
 * Repositorio, instante actual y extractor real (con el LLM del entorno y caché en disco), iguales para todos los
 * canales.
 */
export async function dependenciasCanal(repo: Repositorio): Promise<{ repo: Repositorio; ahora: string; extractor: Extractor }> {
  return {
    repo,
    ahora: await ahoraHumano(repo),
    extractor: extractorReal({ llm: proveedorDesdeEntorno(), cache: cacheEnDisco() }),
  };
}
