// Mensaje de chat (Telegram) con los datos de la factura en el texto. Mismas etiquetas que el PDF.

import type { ExtraccionParcial } from "../tipos";
import { parsearLineas } from "./etiquetas";

/** Quita la cabecera de exportación ("canal: telegram\nchat_id: …\n\n") si viene. */
export function cuerpoDeChat(texto: string): string {
  const m = /^canal: .*\n(?:[a-z_]+: .*\n)*\n/.exec(texto);
  return m ? texto.slice(m[0].length) : texto;
}

/** Lee los campos de un mensaje de chat con las mismas etiquetas que el PDF. */
export function parsearChat(texto: string): ExtraccionParcial {
  return parsearLineas(cuerpoDeChat(texto).split(/\r?\n/), "chat");
}
