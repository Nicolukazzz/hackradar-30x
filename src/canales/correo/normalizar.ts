// Correo entrante (#14): .eml crudo → DocumentoEntrante. El cuerpo va en `texto_mensaje` para que R10
// también revise lo que dice el correo (no solo el PDF), y el `From` es el remitente que verifica R11.
// Si el servidor de correo dice que SPF, DKIM o DMARC fallaron, el remitente se marca como no verificado:
// queda sin vincular (R11 escala) y no se le responde (evita responderle a un suplantador).

import { simpleParser } from "mailparser";

import type { DocumentoEntrante } from "@/dominio/tipos";

export type Autenticacion = "pasa" | "falla" | "sin_dato";

export type CorreoEntrante = {
  entrada: DocumentoEntrante;
  autenticacion: Autenticacion;
  /** dirección del From tal como llegó (para responder) */
  de: string;
  asunto: string | null;
  message_id: string | null;
};

/** Prefijo del remitente cuando la autenticación falló: no coincide con ningún correo vinculado. */
export const PREFIJO_NO_VERIFICADO = "no-verificado:";

/**
 * Lee `Authentication-Results` (lo agrega el servidor que recibe, p. ej. Gmail: "spf=pass … dkim=pass … dmarc=pass").
 * Un solo `fail` alcanza para no confiar. Sin la cabecera (correos de prueba, /simular) → sin_dato.
 */
export function autenticacionDe(cabeceras: string[]): Autenticacion {
  if (cabeceras.length === 0) return "sin_dato";
  const texto = cabeceras.join(" ").toLowerCase();
  if (/\b(spf|dkim|dmarc)=(fail|softfail|permerror)\b/.test(texto)) return "falla";
  return /\b(spf|dkim|dmarc)=pass\b/.test(texto) ? "pasa" : "sin_dato";
}

/** Momento con zona de Bogotá (formato del registro: 2026-10-16T09:22:04-05:00). */
function enBogota(fecha: Date): string {
  return new Date(fecha.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 19) + "-05:00";
}

export async function correoAEntrada(eml: Buffer, opciones: { recibido_en?: string } = {}): Promise<CorreoEntrante> {
  const correo = await simpleParser(eml);
  const de = correo.from?.value[0]?.address?.trim().toLowerCase();
  if (!de) throw new Error("El correo no tiene remitente (From).");

  const crudas = correo.headerLines.filter((h) => h.key === "authentication-results").map((h) => h.line);
  const autenticacion = autenticacionDe(crudas);
  const recibido_en = opciones.recibido_en ?? (correo.date ? enBogota(correo.date) : undefined);
  if (!recibido_en) throw new Error("El correo no tiene fecha y no se indicó cuándo se recibió.");

  const entrada: DocumentoEntrante = {
    canal: "correo",
    remitente: { tipo: "correo", valor: autenticacion === "falla" ? `${PREFIJO_NO_VERIFICADO}${de}` : de },
    recibido_en,
    adjuntos: correo.attachments
      // Imágenes incrustadas en la firma (logos) no son la factura.
      .filter((a) => a.contentDisposition !== "inline" || !a.contentType.startsWith("image/"))
      .map((a, i) => ({ nombre: a.filename ?? `adjunto-${i + 1}`, mime: a.contentType, bytes_base64: a.content.toString("base64") })),
  };
  if (correo.subject) entrada.asunto = correo.subject;
  const cuerpo = (correo.text ?? "").trim();
  if (cuerpo) entrada.texto_mensaje = cuerpo;
  return { entrada, autenticacion, de, asunto: correo.subject ?? null, message_id: correo.messageId ?? null };
}
