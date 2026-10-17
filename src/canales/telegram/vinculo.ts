// Enlace para vincular un chat de Telegram a un beneficiario (#13): `https://t.me/<bot>?start=<token>`. Lo genera la
// empresa (panel o `npm run telegram -- enlace <beneficiario>`) y se lo manda al proveedor por un medio que ya conoce.
// Sin base de datos: el token lleva el beneficiario y el vencimiento, firmados con HMAC. Un solo uso: al vincular,
// el sha256 del token queda en la entrada CAMBIO_BENEFICIARIOS del registro y no se acepta otra vez.
// Telegram limita el parámetro de /start a 64 caracteres de [A-Za-z0-9_-].

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const LARGO_FIRMA = 16; // 12 bytes en base64url
const LARGO_VENCE = 7; // segundos epoch en base 36
export const VIGENCIA_HORAS = 72;

function firmar(secreto: string, datos: string): string {
  const clave = createHash("sha256").update(`vinculo-telegram:${secreto}`).digest();
  return createHmac("sha256", clave).update(datos).digest().subarray(0, 12).toString("base64url");
}

/** `ahora` ISO. El token cabe en los 64 caracteres de /start para ids de hasta 30 caracteres. */
export function crearTokenVinculo(beneficiario_id: string, ahora: string, secreto: string, horas = VIGENCIA_HORAS): string {
  if (!secreto) throw new Error("Falta TELEGRAM_WEBHOOK_SECRET para firmar el enlace");
  const vence = Math.floor(Date.parse(ahora) / 1000 + horas * 3600).toString(36).padStart(LARGO_VENCE, "0");
  const id = Buffer.from(beneficiario_id, "utf8").toString("base64url");
  const token = `${firmar(secreto, `${vence}.${id}`)}${vence}${id}`;
  if (token.length > 64) throw new Error(`el id ${beneficiario_id} es demasiado largo para un enlace de Telegram`);
  return token;
}

/** El beneficiario del token, o null si está mal formado, adulterado o vencido. */
export function leerTokenVinculo(token: string, ahora: string, secreto: string): string | null {
  if (!secreto || !/^[A-Za-z0-9_-]{24,64}$/.test(token)) return null;
  const firma = token.slice(0, LARGO_FIRMA);
  const vence = token.slice(LARGO_FIRMA, LARGO_FIRMA + LARGO_VENCE);
  const id = token.slice(LARGO_FIRMA + LARGO_VENCE);
  const esperada = Buffer.from(firmar(secreto, `${vence}.${id}`));
  if (esperada.length !== Buffer.byteLength(firma) || !timingSafeEqual(esperada, Buffer.from(firma))) return null;
  if (Number.parseInt(vence, 36) * 1000 <= Date.parse(ahora)) return null;
  return Buffer.from(id, "base64url").toString("utf8") || null;
}

/** Lo que queda en el registro para que el token no se use dos veces (nunca el token en claro). */
export function huellaToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
