import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Sesión del proveedor en el portal (#85): una cookie firmada con HMAC `<enlace_id>.<vence>.<firma>`. La firma incluye
// el hash del código vigente: cambiar el código o revocar el enlace cierra al instante cualquier sesión abierta.
// Secreto: `PORTAL_PROVEEDOR_SECRETO` o, si no está, uno derivado de `SUPABASE_SECRET_KEY` (en producción existe
// siempre). En desarrollo sin ninguno, uno al azar por proceso (reiniciar el servidor cierra las sesiones).

export const COOKIE_PROVEEDOR = "hr_proveedor";
export const DURACION_SESION_MS = 2 * 60 * 60 * 1000;

const CLAVE = Symbol.for("hackradar.portal-proveedor.secreto");
type Global = typeof globalThis & { [CLAVE]?: Buffer };

function secreto(env: NodeJS.ProcessEnv = process.env): Buffer {
  const base = env.PORTAL_PROVEEDOR_SECRETO?.trim() || env.SUPABASE_SECRET_KEY?.trim();
  if (base) return createHash("sha256").update(`portal-proveedor:${base}`).digest();
  if (env.NODE_ENV === "production") throw new Error("El portal del proveedor necesita PORTAL_PROVEEDOR_SECRETO o SUPABASE_SECRET_KEY");
  const g = globalThis as Global;
  g[CLAVE] ??= randomBytes(32);
  return g[CLAVE];
}

function firmar(datos: string): string {
  return createHmac("sha256", secreto()).update(datos).digest("base64url");
}

/** sha256 de un valor normalizado (token o código), en hex. */
export function hashValor(valor: string): string {
  return createHash("sha256").update(valor, "utf8").digest("hex");
}

/** Compara dos hashes hex sin filtrar por tiempo cuál carácter difiere. */
export function hashesIguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function crearValorSesion(enlace_id: string, codigo_hash: string, ahora: string): { valor: string; vence: Date } {
  const vence = Date.parse(ahora) + DURACION_SESION_MS;
  const base = `${enlace_id}.${vence.toString(36)}`;
  return { valor: `${base}.${firmar(`${base}.${codigo_hash}`)}`, vence: new Date(vence) };
}

/** true si la cookie es de este enlace, no venció y se firmó con el código vigente. */
export function sesionValida(valor: string | undefined, enlace_id: string, codigo_hash: string, ahora: string): boolean {
  if (!valor) return false;
  const partes = valor.split(".");
  if (partes.length !== 3) return false;
  const [id, vence, firma] = partes as [string, string, string];
  if (id !== enlace_id || Number.parseInt(vence, 36) <= Date.parse(ahora)) return false;
  return hashesIguales(firmar(`${id}.${vence}.${codigo_hash}`), firma);
}
