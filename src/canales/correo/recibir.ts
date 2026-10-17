// Un correo de punta a punta (#14): normalizar → ingesta única (#11) → decisión → respuesta al remitente.
// Lo usan /api/canales/correo/simular (demo con los .eml del dataset) y el buzón IMAP (sondeo.ts).

import type { EntradaRegistro } from "@/dominio/tipos";
import { ingerir } from "@/ingesta/ingerir";
import { type Extractor, procesarDocumento } from "@/ingesta/pipeline";
import { textoRespuesta } from "@/ingesta/respuesta";
import { mimeDeArchivo } from "@/lib/mime";
import type { Repositorio } from "@/repositorio/repositorio";

import { correoAEntrada } from "./normalizar";

export type Respuesta = { para: string; asunto: string; texto: string; en_respuesta_a: string | null };

export type ResultadoCorreo =
  | { ignorado: null; entrada: EntradaRegistro; respuesta: Respuesta | null }
  | { ignorado: string };

export type DependenciasCorreo = {
  repo: Repositorio;
  ahora: string;
  extractor: Extractor;
  urlPortal: string;
  /** buzón real: true (sin dmarc=pass el remitente no se verifica). /simular: false. */
  exigirAutenticacion?: boolean;
  /** dirección del propio buzón: lo que manda él mismo no se procesa (evita bucles) */
  buzonPropio?: string | null;
};

export async function recibirCorreo(eml: Buffer, deps: DependenciasCorreo): Promise<ResultadoCorreo> {
  const correo = await correoAEntrada(eml, {
    recibido_en: deps.ahora,
    exigirAutenticacion: deps.exigirAutenticacion ?? true,
    buzonPropio: deps.buzonPropio ?? null,
  });
  // Rebotes y respuestas automáticas no son facturas: ni se ingieren ni se responden (sin bucles).
  if (correo.automatico) return { ignorado: correo.automatico };

  // El archivo original que se guarda es el .eml completo: la Traza muestra el correo tal como llegó.
  const original = { nombre: "correo.eml", mime: mimeDeArchivo("correo.eml"), bytes: eml };
  const doc = await ingerir(correo.entrada, { repo: deps.repo, reloj: { ahora: () => deps.ahora }, original });
  const entrada = await procesarDocumento(doc.ref_interna, { repo: deps.repo, ahora: deps.ahora, extractor: deps.extractor });

  // Nunca se responde si el servidor de correo dijo que el remitente es falso (sería escribirle a la víctima).
  if (correo.autenticacion === "falla") return { ignorado: null, entrada, respuesta: null };
  let asunto = "Recibimos tu documento";
  if (correo.asunto) asunto = /^re:/i.test(correo.asunto) ? correo.asunto : `Re: ${correo.asunto}`;
  return {
    ignorado: null,
    entrada,
    respuesta: {
      para: correo.de,
      asunto,
      texto: textoRespuesta(entrada, entrada.extraccion?.idioma ?? "es", { urlPortal: deps.urlPortal }),
      en_respuesta_a: correo.message_id,
    },
  };
}
