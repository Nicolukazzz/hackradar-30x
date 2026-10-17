// Ingesta única (§8 pasos 1–2): todo canal (portal, correo, Telegram, carga manual) entra por aquí.
// Valida el DocumentoEntrante, calcula el hash, asigna la ref interna INT-AAAA-NNNNNN, identifica a qué
// beneficiario está vinculado el remitente (R11) y guarda documento y archivo. No extrae ni decide:
// eso lo hace `procesarDocumento` (pipeline.ts).

import { createHash } from "node:crypto";

import { DocumentoEntranteSchema } from "@/dominio/esquemas";
import type { Reloj } from "@/dominio/reloj";
import type { Beneficiario, DocumentoEntrante, DocumentoRecibido, Formato, Remitente } from "@/dominio/tipos";
import { leerAdjunto } from "@/extraccion/normalizar";
import type { ArchivoGuardado, Repositorio } from "@/repositorio/repositorio";

export type DependenciasIngesta = {
  repo: Repositorio;
  /** año de la ref interna: la ref se asigna al recibir (§16 punto 5) */
  reloj: Reloj;
  /** carpeta contra la que se resuelven las `ruta` de los adjuntos (dataset); los canales mandan bytes */
  dirBase?: string;
  /** archivo original a guardar si no es el adjunto principal (el .eml completo de un correo del dataset) */
  original?: ArchivoGuardado;
};

/** Formato del documento (§3): el correo es correo aunque traiga PDF; sin adjunto es chat. */
export function formatoDe(entrada: Pick<DocumentoEntrante, "canal" | "adjuntos">): Formato {
  if (entrada.canal === "correo") return "correo";
  const principal = entrada.adjuntos[0];
  if (!principal) return "chat";
  const nombre = principal.nombre.toLowerCase();
  const mime = principal.mime.toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|heic)$/.test(nombre)) return "imagen";
  if (mime.includes("xml") || nombre.endsWith(".xml")) return "xml";
  if (mime === "message/rfc822" || nombre.endsWith(".eml")) return "correo";
  return "pdf";
}

/**
 * Beneficiario al que está vinculado el remitente (R11). Correos en minúsculas y con el dominio completo:
 * `pagos-cloudnorte@gmail.example` no es `billing@cloudnorte.example`. `interno` → null (R11 lo resuelve con R3).
 */
export function beneficiarioDelRemitente(remitente: Remitente, beneficiarios: readonly Beneficiario[]): string | null {
  const { tipo, valor } = remitente;
  const limpio = valor.trim();
  const b = beneficiarios.find((x) => {
    if (tipo === "correo") return x.canales.correos.some((c) => c.toLowerCase() === limpio.toLowerCase());
    if (tipo === "telegram") return x.canales.telegram_chat_id === limpio;
    if (tipo === "portal") return x.canales.portal_usuario === limpio;
    return false;
  });
  return b?.id ?? null;
}

/** Bytes del adjunto principal o, sin adjunto, el texto del mensaje en UTF-8 (§11.1). */
export async function bytesPrincipales(entrada: DocumentoEntrante, dirBase?: string): Promise<Buffer> {
  const principal = entrada.adjuntos[0];
  return principal ? leerAdjunto(principal, { dirBase }) : Buffer.from(entrada.texto_mensaje ?? "", "utf8");
}

export const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** Arma el DocumentoRecibido sin tocar el repositorio (lo usa también el modo golden de la evaluación). */
export async function recibir(
  entrada: DocumentoEntrante,
  ref_interna: string,
  beneficiarios: readonly Beneficiario[],
  dirBase?: string,
): Promise<{ doc: DocumentoRecibido; bytes: Buffer }> {
  const bytes = await bytesPrincipales(entrada, dirBase);
  const doc: DocumentoRecibido = {
    ...entrada,
    ref_interna,
    sha256: sha256(bytes),
    formato: formatoDe(entrada),
    beneficiario_remitente_id: beneficiarioDelRemitente(entrada.remitente, beneficiarios),
  };
  return { doc, bytes };
}

export async function ingerir(entrada: DocumentoEntrante, deps: DependenciasIngesta): Promise<DocumentoRecibido> {
  const valida = DocumentoEntranteSchema.parse(entrada);
  const { repo } = deps;
  // En exclusiva: la ref se calcula y se reserva (guardarDocumento) sin que otro canal tome la misma.
  return repo.enExclusiva(async () => {
    const datos = await repo.datosComunes();
    const ref = await repo.siguienteRef(Number(deps.reloj.ahora().slice(0, 4)));
    const { doc, bytes } = await recibir(valida, ref, datos.beneficiarios, deps.dirBase);
    const principal = valida.adjuntos[0];
    const archivo: ArchivoGuardado = deps.original ?? {
      nombre: principal?.nombre ?? `${ref}.txt`,
      mime: principal?.mime ?? "text/plain; charset=utf-8",
      bytes,
    };
    await repo.guardarArchivo(ref, archivo);
    await repo.guardarDocumento(doc);
    return doc;
  });
}
