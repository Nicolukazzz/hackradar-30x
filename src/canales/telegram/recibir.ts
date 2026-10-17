// Un mensaje de Telegram de punta a punta (#13): /start <token> vincula el chat, /estado <ref> dice el estado, y una
// foto, un PDF o un texto que parece factura entra por la ingesta única (#11) y se responde con la ref y el estado.
// Lo usan el webhook (`/api/canales/telegram`) y `/simular` (demo sin bot). Nunca se responden reglas internas.

import { z } from "zod";

import type { DocumentoEntrante, EntradaRegistro, Idioma } from "@/dominio/tipos";
import { ingerir } from "@/ingesta/ingerir";
import { MAX_BYTES } from "@/ingesta/limites";
import { type Extractor, procesarDocumento } from "@/ingesta/pipeline";
import { textoRespuesta } from "@/ingesta/respuesta";
import { sanearNombre, validarArchivo } from "@/ingesta/validar-archivo";
import type { Repositorio } from "@/repositorio/repositorio";

import type { ClienteTelegram } from "./cliente";
import { huellaToken, leerTokenVinculo } from "./vinculo";

const Archivo = z.object({ file_id: z.string().min(1).max(300), file_size: z.number().int().nonnegative().optional() });

/** Solo lo que se usa de un Update (https://core.telegram.org/bots/api#update); el resto se ignora. */
export const UpdateSchema = z.object({
  update_id: z.number().int(),
  message: z
    .object({
      message_id: z.number().int(),
      chat: z.object({ id: z.number().int(), type: z.string() }),
      from: z.object({ language_code: z.string().optional() }).optional(),
      text: z.string().max(4096).optional(),
      caption: z.string().max(1024).optional(),
      document: Archivo.extend({ file_name: z.string().max(255).optional(), mime_type: z.string().max(100).optional() }).optional(),
      photo: z.array(Archivo.extend({ width: z.number().int(), height: z.number().int() })).max(20).optional(),
    })
    .optional(),
});

export type UpdateTelegram = z.infer<typeof UpdateSchema>;

export type DependenciasTelegram = {
  repo: Repositorio;
  ahora: string;
  extractor: Extractor;
  /** descarga de archivos (el webhook usa la Bot API; /simular, los archivos que trae la petición) */
  telegram: Pick<ClienteTelegram, "descargarArchivo">;
  /** firma de los enlaces de vinculación (TELEGRAM_WEBHOOK_SECRET) */
  secreto: string;
  /**
   * false en /simular de producción: el chat lo escribe quien llama, no Telegram. El remitente queda `no-verificado:`
   * (R11 escala) y /start y /estado no se aceptan.
   */
  confiarChat: boolean;
};

export type ResultadoTelegram = { chat_id: string; respuesta: string | null; entrada?: EntradaRegistro; ignorado?: string };

const TEXTOS = {
  es: {
    ayuda:
      "Hola. Envíame aquí tu factura o cuenta de cobro: foto, PDF o el texto con número, valor y cuenta. Te respondo con la referencia y el estado. Para consultar uno: /estado INT-2026-000123.",
    vinculado: (n: string) => `Listo, ${n}. Este chat quedó vinculado: ya puedes enviarme tus facturas aquí.`,
    enlace_invalido: "Este enlace de vinculación ya no sirve (venció o ya se usó). Pide uno nuevo a tu contacto en el equipo de finanzas.",
    sin_ref: "No encontramos esa referencia en este chat. Escríbela así: /estado INT-2026-000123.",
    archivo: "No pude leer ese archivo. Envía la factura como PDF, foto (PNG o JPG) o XML de hasta 10 MB.",
    solo_privado: "Escríbeme por chat privado para enviar facturas.",
  },
  en: {
    ayuda: "Hi. Send me your invoice here: a photo, a PDF or the text with number, amount and account. I will reply with the reference and status. To check one: /estado INT-2026-000123.",
    vinculado: (n: string) => `Done, ${n}. This chat is now linked: you can send me your invoices here.`,
    enlace_invalido: "This link no longer works (it expired or was already used). Ask your contact on the finance team for a new one.",
    sin_ref: "We could not find that reference in this chat. Write it like this: /estado INT-2026-000123.",
    archivo: "I could not read that file. Send the invoice as a PDF, photo (PNG or JPG) or XML up to 10 MB.",
    solo_privado: "Message me in a private chat to send invoices.",
  },
  pt: {
    ayuda: "Olá. Envie aqui sua fatura: foto, PDF ou o texto com número, valor e conta. Respondo com a referência e o status. Para consultar: /estado INT-2026-000123.",
    vinculado: (n: string) => `Pronto, ${n}. Este chat foi vinculado: já pode me enviar suas faturas aqui.`,
    enlace_invalido: "Este link não funciona mais (venceu ou já foi usado). Peça um novo ao seu contato na equipe financeira.",
    sin_ref: "Não encontramos essa referência neste chat. Escreva assim: /estado INT-2026-000123.",
    archivo: "Não consegui ler esse arquivo. Envie a fatura em PDF, foto (PNG ou JPG) ou XML de até 10 MB.",
    solo_privado: "Fale comigo no chat privado para enviar faturas.",
  },
} satisfies Record<Idioma, unknown>;

function idiomaDe(codigo: string | undefined): Idioma {
  const c = (codigo ?? "").slice(0, 2).toLowerCase();
  return c === "en" || c === "pt" ? c : "es";
}

/** Un texto suelto entra como factura solo si trae un número de documento y un valor. */
export function pareceFactura(texto: string): boolean {
  const documento = /(factura|cuenta de cobro|invoice|fatura|n\.?\s?[ºo°]|\b[A-Z]{1,6}-\d{2,})/i.test(texto);
  const valor = /(USD|COP|MXN|BRL|ARS|CLP|PEN|EUR|US\$|R\$|\$)\s?\d[\d.,]*/i.test(texto) || /\d[\d.,]*\s?(USD|COP|MXN|BRL|ARS|CLP|PEN|EUR)\b/i.test(texto);
  return documento && valor;
}

async function vincular(token: string, chat: string, deps: DependenciasTelegram, t: (typeof TEXTOS)[Idioma]): Promise<string> {
  const id = leerTokenVinculo(token, deps.ahora, deps.secreto);
  if (!id) return t.enlace_invalido;
  const huella = huellaToken(token);
  return deps.repo.enExclusiva(async () => {
    const usado = (await deps.repo.registro({ tipo: ["CAMBIO_BENEFICIARIOS"] })).some((e) => e.sha256 === huella);
    const b = (await deps.repo.datosComunes()).beneficiarios.find((x) => x.id === id);
    if (usado || !b || b.estado !== "activo") return t.enlace_invalido;
    await deps.repo.vincularTelegram(b.id, chat);
    // Append-only: quién quedó vinculado y desde qué chat. La huella del token impide usarlo de nuevo.
    await deps.repo.agregarEntrada({
      id: await deps.repo.siguienteIdRegistro(Number(deps.ahora.slice(0, 4))),
      momento: deps.ahora,
      actor: { tipo: "agente" },
      tipo: "CAMBIO_BENEFICIARIOS",
      ref_interna: `CANAL-TELEGRAM-${b.id}`,
      factura_numero: null,
      beneficiario: b.nombre,
      canal: "telegram",
      formato: "chat",
      monto_original: null,
      monto_usd_centavos: null,
      tasa_usada: null,
      decision: null,
      reglas_version: (await deps.repo.reglasVigentes()).version,
      evaluaciones: [],
      reglas_que_fallaron: [],
      comparaciones: [],
      explicacion: `${b.nombre} vinculó el chat de Telegram ${chat} con un enlace generado por la empresa. Sus facturas por este chat cumplen R11.`,
      comentario: null,
      entrada_origen: null,
      extraccion: null,
      sha256: huella,
    });
    return t.vinculado(b.nombre);
  });
}

async function estado(ref: string, chat: string, deps: DependenciasTelegram, t: (typeof TEXTOS)[Idioma], idioma: Idioma): Promise<string> {
  const doc = /^INT-\d{4}-\d{6}$/.test(ref) ? await deps.repo.documento(ref) : null;
  // Solo las refs que mandó este mismo chat: no se confirma nada de documentos ajenos.
  if (!doc || doc.remitente.tipo !== "telegram" || doc.remitente.valor !== chat) return t.sin_ref;
  const registro = await deps.repo.registro({ ref_interna: ref });
  const agente = registro.findLast((e) => e.tipo === "DECISION_AGENTE");
  if (!agente) return t.sin_ref;
  const final = registro.findLast((e) => e.tipo === "DECISION_HUMANA" && e.decision !== null);
  if (final?.decision === "APROBADA_HUMANO") return textoRespuesta({ ...agente, decision: "PAGAR", reglas_que_fallaron: [] }, idioma);
  if (final?.decision === "RECHAZADA_HUMANO") return textoRespuesta({ ...agente, decision: "FRENAR", reglas_que_fallaron: [] }, idioma);
  return textoRespuesta(agente, idioma);
}

export async function recibirTelegram(update: UpdateTelegram, deps: DependenciasTelegram): Promise<ResultadoTelegram> {
  const m = update.message;
  if (!m) return { chat_id: "", respuesta: null, ignorado: "sin mensaje" };
  const chat = String(m.chat.id);
  const t = TEXTOS[idiomaDe(m.from?.language_code)];
  const idioma = idiomaDe(m.from?.language_code);
  // Grupos y canales no: el remitente tiene que ser una persona con su chat privado (R11 compara ese chat).
  if (m.chat.type !== "private") return { chat_id: chat, respuesta: t.solo_privado, ignorado: "chat no privado" };

  const texto = (m.text ?? "").trim();
  if (texto.startsWith("/start")) {
    const token = texto.slice("/start".length).trim();
    if (!token) return { chat_id: chat, respuesta: t.ayuda };
    return { chat_id: chat, respuesta: deps.confiarChat ? await vincular(token, chat, deps, t) : t.enlace_invalido };
  }
  if (texto.startsWith("/estado")) {
    return { chat_id: chat, respuesta: deps.confiarChat ? await estado(texto.slice("/estado".length).trim().toUpperCase(), chat, deps, t, idioma) : t.sin_ref };
  }

  // Foto: la de mayor resolución. Documento: PDF, imagen o XML.
  const foto = m.photo?.toSorted((a, b) => b.width * b.height - a.width * a.height)[0];
  const archivo = m.document ?? foto;
  let adjuntos: DocumentoEntrante["adjuntos"] = [];
  let original: { nombre: string; mime: string; bytes: Buffer } | undefined;
  if (archivo) {
    if ((archivo.file_size ?? 0) > MAX_BYTES) return { chat_id: chat, respuesta: t.archivo, ignorado: "archivo grande" };
    const bytes = await deps.telegram.descargarArchivo(archivo.file_id, MAX_BYTES).catch(() => null);
    const v = bytes ? validarArchivo(bytes) : null;
    if (!bytes || !v?.ok) return { chat_id: chat, respuesta: t.archivo, ignorado: "archivo inválido" };
    const nombre = sanearNombre(m.document?.file_name ?? `foto-${m.message_id}.${v.extension}`);
    adjuntos = [{ nombre, mime: v.mime, bytes_base64: bytes.toString("base64") }];
    original = { nombre, mime: v.mime, bytes };
  } else if (!pareceFactura(texto)) {
    return { chat_id: chat, respuesta: t.ayuda };
  }

  const entrante: DocumentoEntrante = {
    canal: "telegram",
    // /simular en producción: el chat lo escribió quien llama, nunca se da por vinculado.
    remitente: { tipo: "telegram", valor: deps.confiarChat ? chat : `no-verificado:${chat}` },
    recibido_en: deps.ahora,
    texto_mensaje: archivo ? m.caption : texto,
    adjuntos,
  };
  const doc = await ingerir(entrante, { repo: deps.repo, reloj: { ahora: () => deps.ahora }, original });
  const entrada = await procesarDocumento(doc.ref_interna, { repo: deps.repo, ahora: deps.ahora, extractor: deps.extractor });
  return { chat_id: chat, entrada, respuesta: textoRespuesta(entrada, entrada.extraccion?.idioma ?? idioma) };
}
