// Un correo de punta a punta (#14): normalizar → ingesta única (#11) → decisión → respuesta al remitente.
// Lo usan /api/canales/correo/simular (demo con los .eml del dataset) y el buzón IMAP (imap.ts).

import type { EntradaRegistro } from "@/dominio/tipos";
import { ingerir } from "@/ingesta/ingerir";
import { type Extractor, procesarDocumento } from "@/ingesta/pipeline";
import { textoRespuesta } from "@/ingesta/respuesta";
import { mimeDeArchivo } from "@/lib/mime";
import type { Repositorio } from "@/repositorio/repositorio";

import { correoAEntrada } from "./normalizar";

export type Respuesta = { para: string; asunto: string; texto: string; en_respuesta_a: string | null };

export type ResultadoCorreo = { entrada: EntradaRegistro; respuesta: Respuesta | null };

export type DependenciasCorreo = {
  repo: Repositorio;
  ahora: string;
  extractor: Extractor;
  urlPortal: string;
};

export async function recibirCorreo(eml: Buffer, deps: DependenciasCorreo): Promise<ResultadoCorreo> {
  const correo = await correoAEntrada(eml, { recibido_en: deps.ahora });
  // El archivo original que se guarda es el .eml completo: la Traza muestra el correo tal como llegó.
  const original = { nombre: "correo.eml", mime: mimeDeArchivo("correo.eml"), bytes: eml };
  const doc = await ingerir(correo.entrada, { repo: deps.repo, reloj: { ahora: () => deps.ahora }, original });
  const entrada = await procesarDocumento(doc.ref_interna, { repo: deps.repo, ahora: deps.ahora, extractor: deps.extractor });

  // Nunca se responde si el servidor de correo dijo que el remitente es falso (backscatter a la víctima).
  if (correo.autenticacion === "falla") return { entrada, respuesta: null };
  const asunto = correo.asunto ? (/^re:/i.test(correo.asunto) ? correo.asunto : `Re: ${correo.asunto}`) : "Recibimos tu documento";
  return {
    entrada,
    respuesta: {
      para: correo.de,
      asunto,
      texto: textoRespuesta(entrada, entrada.extraccion?.idioma ?? "es", { urlPortal: deps.urlPortal }),
      en_respuesta_a: correo.message_id,
    },
  };
}
