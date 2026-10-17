import { createHash, randomBytes } from "node:crypto";

// Token del enlace de invitación: 32 bytes aleatorios en base64url (43 caracteres). En la base solo queda su
// sha256: quien lea la tabla no puede armar un enlace válido.

const FORMATO = /^[A-Za-z0-9_-]{43}$/;

export function generarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Descarta antes de ir a la base lo que no puede ser un token (URL manipulada, texto suelto). */
export function pareceToken(token: string): boolean {
  return FORMATO.test(token);
}
