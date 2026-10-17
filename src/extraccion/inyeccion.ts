// Detector de instrucciones dirigidas al agente (R10) para el extractor. Hay uno solo: el del motor
// (src/reglas/inyeccion.ts, especificación §2 y §16.7a). Aquí solo se adapta a una lista de fragmentos, para que
// extracción, Traza y R10 nunca vean cosas distintas en el mismo texto.

import { detectarInstrucciones as detectarHallazgos } from "@/reglas/inyeccion";

/** Fragmentos sospechosos en orden de aparición, sin repetir (como los lee el modelo: Tags invisibles decodificados). */
export function detectarInstrucciones(texto: string): string[] {
  return [...new Set(detectarHallazgos(texto).map((h) => h.fragmento))];
}
