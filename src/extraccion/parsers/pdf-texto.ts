// PDF con capa de texto → líneas en orden de lectura → campos por etiqueta (sin IA).
// Un PDF con menos de 50 caracteres de texto se trata como escaneado (lo lee el LLM).

import { getDocumentProxy } from "unpdf";

import type { ExtraccionParcial } from "../tipos";
import { parsearLineas } from "./etiquetas";

export const MINIMO_CARACTERES_PDF = 50;

type Trozo = { x: number; y: number; ancho: number; texto: string };

/** Separación horizontal (pt) a partir de la cual dos trozos del mismo renglón son celdas distintas. */
const HUECO_CELDA = 15;
/** Dos trozos con |Δy| menor que esto están en el mismo renglón. */
const TOLERANCIA_Y = 2;

/** Une los trozos de texto por renglón (y descendente) y los ordena por x. Celdas lejanas → " | ". */
export function unirRenglones(trozos: Trozo[]): string[] {
  const renglones: Trozo[][] = [];
  const ordenados = trozos.filter((t) => t.texto.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  for (const t of ordenados) {
    const actual = renglones.at(-1);
    if (actual && Math.abs((actual[0]?.y ?? 0) - t.y) < TOLERANCIA_Y) actual.push(t);
    else renglones.push([t]);
  }
  return renglones.map((r) => {
    r.sort((a, b) => a.x - b.x);
    let linea = "";
    let fin = -Infinity;
    for (const t of r) {
      const hueco = t.x - fin;
      if (linea) linea += hueco > HUECO_CELDA ? " | " : " ";
      linea += t.texto.trim();
      fin = t.x + t.ancho;
    }
    return linea;
  });
}

/** Texto de todas las páginas, una línea por renglón visual. */
export async function textoDePdf(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  try {
    const lineas: string[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n);
      const contenido = await pagina.getTextContent();
      const trozos = contenido.items.flatMap((it) =>
        "str" in it ? [{ x: Number(it.transform[4] ?? 0), y: Number(it.transform[5] ?? 0), ancho: it.width, texto: it.str }] : [],
      );
      lineas.push(...unirRenglones(trozos));
    }
    return lineas;
  } finally {
    // El servidor de Next vive mucho: liberar el documento aunque la lectura falle.
    await pdf.loadingTask.destroy();
  }
}

export function esPdfEscaneado(lineas: string[]): boolean {
  return lineas.join("").replace(/\s/g, "").length < MINIMO_CARACTERES_PDF;
}

export function parsearPdf(lineas: string[]): ExtraccionParcial {
  return parsearLineas(lineas, "documento");
}
