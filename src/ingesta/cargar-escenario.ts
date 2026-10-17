// Carga un escenario del dataset por la ingesta real (#11): cada documento entra como si llegara por su
// canal (ingerir → procesarDocumento), en orden de llegada y con el reloj fijo del escenario.
// Lo usan scripts/cargar-escenario.ts y los tests; los canales (#12, #13, #14) llaman lo mismo, uno por uno.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { cargarEscenario, DIR_DATA_POR_DEFECTO } from "@/dominio/cargar";
import { relojFijo } from "@/dominio/reloj";
import type { EntradaRegistro } from "@/dominio/tipos";
import { cargarGolden } from "@/evaluacion/escenario";
import type { Repositorio } from "@/repositorio/repositorio";

import { ingerir } from "./ingerir";
import { type Extractor, procesarDocumento } from "./pipeline";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".eml": "message/rfc822",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

/**
 * Extracción golden por hash del archivo: devuelve la `extraccion_esperada` del documento del escenario.
 * Sirve para cargar la demo sin LLM con el resultado exacto del prototipo. Un archivo que no es del escenario → error.
 */
export async function extractorGolden(id: string, dir: string = DIR_DATA_POR_DEFECTO): Promise<Extractor> {
  const golden = await cargarGolden(id, dir);
  const porHash = new Map(golden.docs.map((d) => [d.doc.sha256, d.ext]));
  return async (doc) => {
    const ext = porHash.get(doc.sha256);
    if (!ext) throw new Error(`${doc.ref_interna} no es un documento del escenario ${id}: no hay extracción golden.`);
    return structuredClone(ext);
  };
}

export async function cargarEscenarioPorIngesta(
  id: string,
  deps: { repo: Repositorio; extractor: Extractor; dir?: string },
): Promise<EntradaRegistro[]> {
  const esc = await cargarEscenario(id, deps.dir ?? DIR_DATA_POR_DEFECTO);
  const reloj = relojFijo(esc.config.ahora);
  const entradas: EntradaRegistro[] = [];
  // cargarEscenario ya los entrega en orden de llegada (recibido_en).
  for (const { archivo_original, ...entrada } of esc.documentos) {
    const original = {
      nombre: path.basename(archivo_original),
      mime: MIME[path.extname(archivo_original)] ?? "application/octet-stream",
      bytes: await readFile(path.join(esc.carpeta, archivo_original)),
    };
    const doc = await ingerir(entrada, { repo: deps.repo, reloj, dirBase: esc.carpeta, original });
    entradas.push(await procesarDocumento(doc.ref_interna, { repo: deps.repo, ahora: reloj.ahora(), extractor: deps.extractor }));
  }
  return entradas;
}
