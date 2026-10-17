// Correo entrante (#14): .eml crudo → DocumentoEntrante. El cuerpo va en `texto_mensaje` para que R10
// también revise lo que dice el correo (no solo el PDF), y el `From` es el remitente que verifica R11.
// Ante la duda el remitente queda "no verificado": no coincide con ningún canal vinculado y R11 escala.

import { simpleParser } from "mailparser";

import type { DocumentoEntrante } from "@/dominio/tipos";
import { validarArchivo } from "@/ingesta/validar-archivo";

export type Autenticacion = "pasa" | "falla" | "sin_dato";

export type CorreoEntrante = {
  entrada: DocumentoEntrante;
  autenticacion: Autenticacion;
  /** motivo si es un correo automático (rebote, respuesta automática, no-reply): no se ingesta ni se responde */
  automatico: string | null;
  /** dirección del From tal como llegó (para responder) */
  de: string;
  asunto: string | null;
  message_id: string | null;
};

/** Prefijo del remitente cuando no se pudo verificar: no coincide con ningún correo vinculado. */
export const PREFIJO_NO_VERIFICADO = "no-verificado:";

/**
 * Veredicto de `Authentication-Results` (lo agrega el servidor que recibe; Gmail siempre lo pone).
 * Solo `dmarc=pass` prueba que el From es del dominio que dice (SPF/DKIM pueden pasar para OTRO dominio).
 * Cualquier fail → falla. Sin cabecera → sin_dato.
 */
export function autenticacionDe(cabeceras: string[]): Autenticacion {
  if (cabeceras.length === 0) return "sin_dato";
  const texto = cabeceras.join(" ").toLowerCase();
  if (/\b(spf|dkim|dmarc)=(fail|softfail|permerror)\b/.test(texto)) return "falla";
  return /\bdmarc=pass\b/.test(texto) ? "pasa" : "sin_dato";
}

const REMITENTES_SISTEMA = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounces?)([+@.-]|$)/i;

/** Rebotes, respuestas automáticas y avisos de sistemas: responderles crea bucles de correo. */
function motivoAutomatico(cabecera: (k: string) => string, de: string, propio: string | null): string | null {
  const autoSubmitted = cabecera("auto-submitted").toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") return "auto-submitted";
  if (/^(bulk|junk|list|auto_reply)$/i.test(cabecera("precedence"))) return "precedence";
  if (cabecera("return-path").replace(/\s/g, "") === "<>") return "rebote";
  if (REMITENTES_SISTEMA.test(de)) return "remitente de sistema";
  if (de === propio?.toLowerCase()) return "enviado por el propio buzón";
  return null;
}

export async function correoAEntrada(
  eml: Buffer,
  opciones: {
    recibido_en: string;
    exigirAutenticacion: boolean;
    buzonPropio?: string | null;
    /**
     * false: el .eml lo subió una persona (/simular en producción), así que sus cabeceras no prueban nada
     * (cualquiera escribe "dmarc=pass"): el remitente nunca queda verificado y R11 escala. Por defecto true:
     * en el buzón real Authentication-Results lo agrega el servidor que recibe.
     */
    confiarCabeceras?: boolean;
  },
): Promise<CorreoEntrante> {
  const correo = await simpleParser(eml);
  const de = correo.from?.value[0]?.address?.trim().toLowerCase();
  if (!de) throw new Error("El correo no tiene remitente (From).");

  const lineas = (clave: string) => correo.headerLines.filter((h) => h.key === clave).map((h) => h.line.slice(h.line.indexOf(":") + 1).trim());
  const autenticacion = autenticacionDe(lineas("authentication-results"));
  // Buzón real: sin dmarc=pass no se confía. /simular (lo sube el panel): solo un fail explícito.
  const verificado =
    opciones.confiarCabeceras !== false && (autenticacion === "pasa" || (!opciones.exigirAutenticacion && autenticacion === "sin_dato"));

  const entrada: DocumentoEntrante = {
    canal: "correo",
    remitente: { tipo: "correo", valor: verificado ? de : `${PREFIJO_NO_VERIFICADO}${de}` },
    recibido_en: opciones.recibido_en,
    adjuntos: correo.attachments
      // Imágenes incrustadas en la firma (logos) no son la factura.
      .filter((a) => a.contentDisposition !== "inline" || !a.contentType.startsWith("image/"))
      // Mismos controles que la subida del portal (#26): tipo real, 10 MB, PDF sin cifrar. Lo que no pasa
      // se descarta; si era la factura, R1 escala por falta de datos.
      .filter((a) => validarArchivo(a.content).ok)
      .map((a, i) => ({ nombre: a.filename ?? `adjunto-${i + 1}`, mime: a.contentType, bytes_base64: a.content.toString("base64") })),
  };
  if (correo.subject) entrada.asunto = correo.subject;
  const cuerpo = (correo.text ?? "").trim();
  if (cuerpo) entrada.texto_mensaje = cuerpo;
  return {
    entrada,
    autenticacion,
    automatico: motivoAutomatico((k) => lineas(k)[0] ?? "", de, opciones.buzonPropio ?? null),
    de,
    asunto: correo.subject ?? null,
    message_id: correo.messageId ?? null,
  };
}
