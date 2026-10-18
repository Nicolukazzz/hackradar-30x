// Correo .eml crudo → asunto, cuerpo y adjuntos (mailparser). Si la factura viene en el cuerpo
// (sin adjunto), el cuerpo se lee con las mismas etiquetas que el chat.

import { simpleParser } from "mailparser";

import type { ExtraccionParcial } from "../tipos";
import { parsearLineas } from "./etiquetas";

/** Partes útiles de un correo: asunto, cuerpo en texto plano y todos sus adjuntos. */
export type CorreoLeido = {
  asunto: string | null;
  cuerpo: string;
  adjuntos: { nombre: string; mime: string; bytes: Buffer }[];
};

/** Abre un `.eml` crudo con mailparser. */
export async function leerEml(bytes: Buffer): Promise<CorreoLeido> {
  const correo = await simpleParser(bytes);
  return {
    asunto: correo.subject ?? null,
    cuerpo: (correo.text ?? "").trim(),
    adjuntos: correo.attachments.map((a, i) => ({
      nombre: a.filename ?? `adjunto-${i + 1}`,
      mime: a.contentType,
      bytes: a.content,
    })),
  };
}

/** Lee los campos de una factura escrita en el cuerpo del correo. */
export function parsearCuerpoCorreo(cuerpo: string): ExtraccionParcial {
  return parsearLineas(cuerpo.split(/\r?\n/), "chat");
}
