// Carga un escenario del dataset por la ingesta real (#11): cada documento entra como si llegara por su
// canal (ingerir → procesarDocumento), en orden de llegada y con el reloj fijo del escenario.
// Lo usan scripts/cargar-escenario.ts y los tests; los canales (#12, #13, #14) llaman lo mismo, uno por uno.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { cargarEscenario, DIR_DATA_POR_DEFECTO } from "@/dominio/cargar";
import { relojFijo } from "@/dominio/reloj";
import type { DocumentoRecibido, EntradaRegistro } from "@/dominio/tipos";
import { cargarGolden } from "@/evaluacion/escenario";
import { mimeDeArchivo } from "@/lib/mime";
import type { Repositorio } from "@/repositorio/repositorio";

import { ingerir } from "./ingerir";
import { type Extractor, procesarDocumento } from "./pipeline";

/**
 * Extracción golden por archivo y texto del envío: devuelve la `extraccion_esperada` del documento del escenario.
 * Sirve para cargar la demo sin LLM con el resultado exacto del prototipo. Un archivo que no es del escenario → error.
 */
export async function extractorGolden(id: string, dir: string = DIR_DATA_POR_DEFECTO): Promise<Extractor> {
  const golden = await cargarGolden(id, dir);
  // Clave = archivo + texto del envío: un "Fwd:" con el mismo PDF es otro documento con otro texto (R10 lo lee).
  const clave = (d: DocumentoRecibido) => [d.sha256, d.asunto ?? "", d.texto_mensaje ?? ""].join("\u0000");
  const porClave = new Map(golden.docs.map((d) => [clave(d.doc), d.ext]));
  return async (doc) => {
    const ext = porClave.get(clave(doc));
    if (!ext) throw new Error(`${doc.ref_interna} no es un documento del escenario ${id}: no hay extracción golden.`);
    return structuredClone(ext);
  };
}

/**
 * Pasa todos los documentos de un escenario por `ingerir` y `procesarDocumento`, con el reloj del escenario. Devuelve
 * una decisión por documento, en orden de llegada.
 */
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
      mime: mimeDeArchivo(archivo_original),
      bytes: await readFile(path.join(esc.carpeta, archivo_original)),
    };
    const doc = await ingerir(entrada, { repo: deps.repo, reloj, dirBase: esc.carpeta, original });
    entradas.push(await procesarDocumento(doc.ref_interna, { repo: deps.repo, ahora: reloj.ahora(), extractor: deps.extractor }));
  }
  return entradas;
}
