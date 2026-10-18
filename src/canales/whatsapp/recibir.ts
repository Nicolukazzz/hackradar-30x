// Un mensaje de WhatsApp de punta a punta (#79), igual que Telegram (#13): "VINCULAR <token>" vincula el número,
// "ESTADO <ref>" dice el estado, y una foto, un PDF o un texto que parece factura entra por la ingesta única (#11) y
// se responde con la ref y el estado. Lo usan el webhook y `/simular` (demo sin Meta). Nunca se responden reglas internas.

import { z } from "zod";

import type { DocumentoEntrante, EntradaRegistro, Idioma } from "@/dominio/tipos";
import { ingerir } from "@/ingesta/ingerir";
import { MAX_BYTES } from "@/ingesta/limites";
import { type Extractor, procesarDocumento } from "@/ingesta/pipeline";
import { sanearNombre, validarArchivo } from "@/ingesta/validar-archivo";
import type { Repositorio } from "@/repositorio/repositorio";

import { pareceFactura } from "../telegram/recibir";
import { huellaToken, leerTokenVinculo } from "../telegram/vinculo";
import type { ClienteWhatsapp } from "./cliente";
import { mensajeFactura } from "./formato";

const Media = z.object({ id: z.string().min(1).max(300), mime_type: z.string().max(100).optional(), caption: z.string().max(1024).optional() });

/** Un mensaje entrante (https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples). */
export const MensajeSchema = z.object({
  from: z.string().regex(/^\d{6,20}$/),
  id: z.string().min(1).max(200),
  type: z.string(),
  text: z.object({ body: z.string().max(4096) }).optional(),
  image: Media.optional(),
  document: Media.extend({ filename: z.string().max(255).optional() }).optional(),
});

/** Solo lo que se usa del webhook; estados de entrega y el resto se ignoran. */
export const WebhookSchema = z.object({
  object: z.string(),
  entry: z
    .array(
      z.object({
        changes: z.array(z.object({ field: z.string(), value: z.object({ messages: z.array(MensajeSchema).max(50).optional() }).loose() })).max(50),
      }),
    )
    .max(50),
});

export type MensajeWhatsapp = z.infer<typeof MensajeSchema>;

/** Los mensajes de un webhook, en orden. */
export function mensajesDe(webhook: z.infer<typeof WebhookSchema>): MensajeWhatsapp[] {
  return webhook.entry.flatMap((e) => e.changes.filter((c) => c.field === "messages").flatMap((c) => c.value.messages ?? []));
}

export type DependenciasWhatsapp = {
  repo: Repositorio;
  ahora: string;
  extractor: Extractor;
  whatsapp: Pick<ClienteWhatsapp, "descargarArchivo">;
  /** firma de los enlaces de vinculación (deriva de WHATSAPP_VERIFY_TOKEN) */
  secreto: string;
  /** false en /simular de producción: el número lo escribe quien llama, no Meta (R11 escala, VINCULAR y ESTADO no valen). */
  confiarNumero: boolean;
};

export type ResultadoWhatsapp = { numero: string; respuesta: string | null; entrada?: EntradaRegistro; ignorado?: string };

const TEXTOS = {
  ayuda: [
    "👋 *Hola, soy el asistente de cuentas por pagar*",
    "",
    "Envíame aquí tu factura o cuenta de cobro:",
    "📄 PDF",
    "📷 Foto (PNG o JPG)",
    "✍️ Texto con número, valor y cuenta",
    "",
    "Te respondo con la referencia y el estado.",
    "Para consultar una: *ESTADO INT-2026-000123*",
  ].join("\n"),
  vinculado: (n: string) => `🔗 *Número vinculado*\n\nListo, ${n}. Ya puedes enviarme tus facturas por aquí.`,
  enlace_invalido: "⚠️ *Enlace no válido*\n\nEste enlace de vinculación venció o ya se usó. Pide uno nuevo a tu contacto en el equipo de finanzas.",
  sin_ref: "🔎 *Referencia no encontrada*\n\nNo encontramos esa referencia en este número. Escríbela así: *ESTADO INT-2026-000123*",
  archivo: "⚠️ *No pude leer el archivo*\n\nEnvía la factura como PDF, foto (PNG o JPG) o XML de hasta 10 MB.",
  tipo: "⚠️ *Formato no soportado*\n\nPor ahora leo PDF, fotos o texto. Envía la factura en uno de esos formatos.",
};

async function vincular(token: string, numero: string, deps: DependenciasWhatsapp): Promise<string> {
  const id = leerTokenVinculo(token, deps.ahora, deps.secreto);
  if (!id) return TEXTOS.enlace_invalido;
  const huella = huellaToken(token);
  return deps.repo.enExclusiva(async () => {
    const usado = await deps.repo.tokenVinculoUsado(huella);
    const b = (await deps.repo.datosComunes()).beneficiarios.find((x) => x.id === id);
    if (usado || !b || b.estado !== "activo") return TEXTOS.enlace_invalido;
    await deps.repo.vincularWhatsapp(b.id, numero);
    // Append-only: quién quedó vinculado y desde qué número. La huella del token impide usarlo de nuevo.
    await deps.repo.agregarEntrada({
      id: await deps.repo.siguienteIdRegistro(Number(deps.ahora.slice(0, 4))),
      momento: deps.ahora,
      actor: { tipo: "agente" },
      tipo: "CAMBIO_BENEFICIARIOS",
      ref_interna: `CANAL-WHATSAPP-${b.id}`,
      factura_numero: null,
      beneficiario: b.nombre,
      canal: "whatsapp",
      formato: "chat",
      monto_original: null,
      monto_usd_centavos: null,
      tasa_usada: null,
      decision: null,
      reglas_version: (await deps.repo.reglasVigentes()).version,
      evaluaciones: [],
      reglas_que_fallaron: [],
      comparaciones: [],
      explicacion: `${b.nombre} vinculó el WhatsApp +${numero} con un enlace generado por la empresa. Sus facturas por este número cumplen R11.`,
      comentario: null,
      entrada_origen: null,
      extraccion: null,
      sha256: huella,
    });
    return TEXTOS.vinculado(b.nombre);
  });
}

async function estado(ref: string, numero: string, deps: DependenciasWhatsapp): Promise<string> {
  const doc = /^INT-\d{4}-\d{6}$/.test(ref) ? await deps.repo.documento(ref) : null;
  // Solo las refs que mandó este mismo número: no se confirma nada de documentos ajenos.
  if (!doc || doc.remitente.tipo !== "whatsapp" || doc.remitente.valor !== numero) return TEXTOS.sin_ref;
  const registro = await deps.repo.registro({ ref_interna: ref });
  const agente = registro.findLast((e) => e.tipo === "DECISION_AGENTE");
  if (!agente) return TEXTOS.sin_ref;
  const idioma: Idioma = agente.extraccion?.idioma ?? "es";
  const final = registro.findLast((e) => e.tipo === "DECISION_HUMANA" && e.decision !== null);
  if (final?.decision === "APROBADA_HUMANO") return mensajeFactura({ ...agente, decision: "PAGAR", reglas_que_fallaron: [] }, idioma);
  if (final?.decision === "RECHAZADA_HUMANO") return mensajeFactura({ ...agente, decision: "FRENAR", reglas_que_fallaron: [] }, idioma);
  return mensajeFactura(agente, idioma);
}

export async function recibirWhatsapp(m: MensajeWhatsapp, deps: DependenciasWhatsapp): Promise<ResultadoWhatsapp> {
  const numero = m.from;
  const texto = (m.text?.body ?? "").trim();
  const comando = /^\/?(vincular|estado)\b\s*(.*)$/is.exec(texto);
  if (comando?.[1]?.toLowerCase() === "vincular") {
    const token = (comando[2] ?? "").trim();
    if (!token) return { numero, respuesta: TEXTOS.ayuda };
    return { numero, respuesta: deps.confiarNumero ? await vincular(token, numero, deps) : TEXTOS.enlace_invalido };
  }
  if (comando?.[1]?.toLowerCase() === "estado") {
    return { numero, respuesta: deps.confiarNumero ? await estado((comando[2] ?? "").trim().toUpperCase(), numero, deps) : TEXTOS.sin_ref };
  }

  const media = m.type === "image" ? m.image : m.type === "document" ? m.document : undefined;
  if (m.type !== "text" && !media) return { numero, respuesta: TEXTOS.tipo, ignorado: `tipo ${m.type}` };
  let adjuntos: DocumentoEntrante["adjuntos"] = [];
  let original: { nombre: string; mime: string; bytes: Buffer } | undefined;
  if (media) {
    const bytes = await deps.whatsapp.descargarArchivo(media.id, MAX_BYTES).catch(() => null);
    const v = bytes ? validarArchivo(bytes) : null;
    if (!bytes || !v?.ok) return { numero, respuesta: TEXTOS.archivo, ignorado: "archivo inválido" };
    const nombre = sanearNombre(m.document?.filename ?? `foto-${m.id.slice(-12)}.${v.extension}`);
    adjuntos = [{ nombre, mime: v.mime, bytes_base64: bytes.toString("base64") }];
    original = { nombre, mime: v.mime, bytes };
  } else if (!pareceFactura(texto)) {
    return { numero, respuesta: TEXTOS.ayuda };
  }

  const entrante: DocumentoEntrante = {
    canal: "whatsapp",
    // /simular en producción: el número lo escribió quien llama, nunca se da por vinculado.
    remitente: { tipo: "whatsapp", valor: deps.confiarNumero ? numero : `no-verificado:${numero}` },
    recibido_en: deps.ahora,
    texto_mensaje: media ? media.caption : texto,
    adjuntos,
  };
  const doc = await ingerir(entrante, { repo: deps.repo, reloj: { ahora: () => deps.ahora }, original });
  const entrada = await procesarDocumento(doc.ref_interna, { repo: deps.repo, ahora: deps.ahora, extractor: deps.extractor });
  return { numero, entrada, respuesta: mensajeFactura(entrada, entrada.extraccion?.idioma ?? "es") };
}
