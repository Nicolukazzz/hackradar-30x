// Documento recibido (correo, chat, PDF, imagen, XML) → DocumentoNormalizado (§8 paso 4).
// Solo servidor: lee adjuntos de disco cuando vienen por ruta (dataset) en vez de bytes.

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Adjunto, DocumentoRecibido } from "@/dominio/tipos";

import { leerEml } from "./parsers/eml";
import { esPdfEscaneado, textoDePdf } from "./parsers/pdf-texto";
import { esXmlFactura } from "./parsers/xml-factura";
import type { ArchivoVisual, DocumentoNormalizado } from "./tipos";

/** Opciones de lectura de adjuntos. */
export type OpcionesNormalizar = {
  /** carpeta contra la que se resuelven las `ruta` de los adjuntos (la del escenario en el dataset) */
  dirBase?: string;
};

/** Carpeta con documentos reales de la empresa de referencia: jamás se lee ni se manda a un LLM. */
const CARPETA_PRIVADA = "contexto-privado";

type ArchivoLeido = { nombre: string; mime: string; bytes: Buffer };

/** Bytes del adjunto. Rechaza rutas fuera de `dirBase` y cualquier cosa bajo contexto-privado/. */
export async function leerAdjunto(adj: Adjunto, opciones: OpcionesNormalizar = {}): Promise<Buffer> {
  if (adj.bytes_base64 !== undefined) return Buffer.from(adj.bytes_base64, "base64");
  if (adj.ruta === undefined) throw new Error(`adjunto ${adj.nombre} sin bytes ni ruta`);
  // Sin carpeta base no se lee nada del disco (antes caía en "." = todo el proyecto).
  if (!opciones.dirBase) throw new Error(`adjunto ${adj.nombre} con ruta pero sin carpeta base (dirBase)`);
  if (path.isAbsolute(adj.ruta)) throw new Error(`ruta de adjunto fuera de la carpeta permitida: ${adj.ruta}`);
  // turbopackIgnore: lectura en tiempo de ejecución, acotada a dirBase y validada abajo; no debe trazar el proyecto entero.
  const base = path.resolve(/*turbopackIgnore: true*/ opciones.dirBase);
  const ruta = path.join(/*turbopackIgnore: true*/ base, adj.ruta);
  if (ruta !== base && !ruta.startsWith(base + path.sep)) throw new Error(`ruta de adjunto fuera de la carpeta permitida: ${adj.ruta}`);
  if (ruta.split(path.sep).includes(CARPETA_PRIVADA)) throw new Error(`prohibido leer ${CARPETA_PRIVADA}/: ${adj.ruta}`);
  return readFile(/*turbopackIgnore: true*/ ruta);
}

function tipoDe(a: { nombre: string; mime: string }): "pdf" | "imagen" | "eml" | "xml" | "texto" | "otro" {
  const ext = path.extname(a.nombre).toLowerCase();
  if (a.mime === "application/pdf" || ext === ".pdf") return "pdf";
  if (a.mime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return "imagen";
  if (a.mime === "message/rfc822" || ext === ".eml") return "eml";
  if (a.mime.endsWith("/xml") || ext === ".xml") return "xml";
  if (a.mime.startsWith("text/") || ext === ".txt") return "texto";
  return "otro";
}

/**
 * Abre el documento: correo anidado, PDF con texto (por líneas), PDF escaneado o imagen (para el LLM) y XML de
 * factura. Un adjunto que no se puede leer se anota en `errores` y no detiene el resto.
 */
export async function normalizarDocumento(doc: DocumentoRecibido, opciones: OpcionesNormalizar = {}): Promise<DocumentoNormalizado> {
  const n: DocumentoNormalizado = {
    formato: doc.formato,
    asunto: doc.asunto ?? null,
    texto_mensaje: doc.texto_mensaje ?? null,
    lineas_adjuntos: [],
    xml: null,
    visuales: [],
    adjunto_principal: doc.adjuntos[0]?.nombre ?? null,
    errores: [],
  };
  // Fallar hacia seguro: un adjunto ilegible no tumba el documento; se anota y sus campos quedan vacíos (R1 escala).
  const anotar = (nombre: string, e: unknown) => n.errores.push(`${nombre}: ${e instanceof Error ? e.message : String(e)}`);

  const pendientes: ArchivoLeido[] = [];
  for (const adj of doc.adjuntos) {
    try {
      pendientes.push({ nombre: adj.nombre, mime: adj.mime, bytes: await leerAdjunto(adj, opciones) });
    } catch (e) {
      anotar(adj.nombre, e);
    }
  }

  // Un .eml crudo se abre: asunto y cuerpo pasan al documento, sus adjuntos se procesan como cualquier otro.
  for (let i = 0; i < pendientes.length; i++) {
    const a = pendientes[i];
    if (!a) continue;
    try {
      await procesar(a);
    } catch (e) {
      anotar(a.nombre, e);
    }
  }
  return n;

  async function procesar(a: ArchivoLeido): Promise<void> {
    switch (tipoDe(a)) {
      case "eml": {
        const correo = await leerEml(a.bytes);
        n.asunto ??= correo.asunto;
        n.texto_mensaje = [n.texto_mensaje, correo.cuerpo].filter(Boolean).join("\n\n") || null;
        pendientes.push(...correo.adjuntos);
        break;
      }
      case "pdf": {
        const lineas = await textoDePdf(a.bytes);
        if (esPdfEscaneado(lineas)) n.visuales.push(a);
        else n.lineas_adjuntos.push(...lineas);
        break;
      }
      case "imagen":
        n.visuales.push(a satisfies ArchivoVisual);
        break;
      case "xml":
      case "texto": {
        const texto = a.bytes.toString("utf8");
        if (esXmlFactura(texto)) n.xml ??= texto;
        n.lineas_adjuntos.push(...texto.split(/\r?\n/));
        break;
      }
      case "otro":
        break;
    }
  }
}

/** Todo el texto que vio el extractor, para R10 y auditoría: asunto, mensaje y adjuntos legibles. */
export function textoCrudo(n: DocumentoNormalizado): string {
  return [n.asunto ? `Asunto: ${n.asunto}` : null, n.texto_mensaje, n.lineas_adjuntos.join("\n")]
    .filter((p): p is string => Boolean(p && p.trim()))
    .join("\n\n");
}
