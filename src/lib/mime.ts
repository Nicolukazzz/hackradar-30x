// Tipo MIME por extensión de los archivos del dataset y de la ingesta. Una sola tabla para repositorio e ingesta.

import path from "node:path";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".eml": "message/rfc822",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

export function mimeDeArchivo(nombre: string): string {
  return MIME[path.extname(nombre).toLowerCase()] ?? "application/octet-stream";
}
