// Textos de fecha, hora y canal para las pantallas. Se leen del texto ISO (2026-10-16T09:24:00-05:00)
// sin pasar por Date: la hora que se muestra es la de la empresa (Bogotá), no la del servidor ni del navegador.

import type { Canal, Formato } from "@/dominio/tipos";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const mes = (iso: string) => MESES[Number(iso.slice(5, 7)) - 1] ?? "";

/** "2026-10" → "Octubre 2026" */
export function mesAnio(periodo: string): string {
  const m = mes(periodo);
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${periodo.slice(0, 4)}`;
}

/** "2026-10-16…" → "16 oct" */
export function diaMes(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${mes(iso).slice(0, 3)}`;
}

/** "2026-10-16…" → "16 oct 2026" */
export function fechaCorta(iso: string): string {
  return `${diaMes(iso)} ${iso.slice(0, 4)}`;
}

/** "…T09:24:00-05:00" → "09:24" (con segundos: "09:24:00") */
export function hora(iso: string, segundos = false): string {
  return iso.slice(11, segundos ? 19 : 16);
}

/** "17 oct, 12:00" (plazos de aprobación) */
export function fechaHora(iso: string): string {
  return `${diaMes(iso)}, ${hora(iso)}`;
}

const FORMATOS: Record<Formato, string> = { pdf: "PDF", correo: "Correo", chat: "Chat", imagen: "Imagen", xml: "XML" };
const CANALES: Record<Canal, string> = { portal: "portal", correo: "correo", telegram: "Telegram", carga_manual: "carga manual" };

/** Cómo llegó, corto: "PDF", "Correo", "Chat", "Imagen" (columna Factura de la Bandeja). */
export function etiquetaFormato(f: Formato): string {
  return FORMATOS[f];
}

/** "correo", "Telegram", "portal" (frases: "Recibida por correo…") */
export function etiquetaCanal(c: Canal): string {
  return CANALES[c];
}

/** 0.6667 → "66,7%" */
export function porcentajeUi(fraccion: number, decimales = 1): string {
  return `${(fraccion * 100).toFixed(decimales).replace(".", ",")}%`;
}
