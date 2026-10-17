// Subida de un archivo desde el portal (proveedor) o el panel ("Cargar factura", carga manual) (#26).
// Valida el tipo real, arma el DocumentoEntrante con el remitente que dice la SESIÓN (nunca el cuerpo)
// y lo pasa por la ingesta única (#11): ref, hash, extracción, motor y registro.

import type { Canal, DecisionAgente, DocumentoEntrante, Remitente } from "@/dominio/tipos";
import { ingerir, sha256 } from "@/ingesta/ingerir";
import { type Extractor, procesarDocumento } from "@/ingesta/pipeline";
import { textoRespuesta } from "@/ingesta/respuesta";
import { sanearNombre, validarArchivo } from "@/ingesta/validar-archivo";
import type { Sesion } from "@/lib/auth/permisos";
import type { Repositorio } from "@/repositorio/repositorio";

export class ErrorSubida extends Error {
  constructor(
    readonly estado: 400 | 403 | 413 | 415 | 422 | 429,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorSubida";
  }
}

export type ResultadoSubida = {
  ref_interna: string;
  estado: DecisionAgente;
  /** proveedor: el aviso de §8 paso 8 (sin reglas internas). Panel: la explicación completa del agente. */
  mensaje: string;
};

export type DependenciasSubida = {
  repo: Repositorio;
  ahora: string;
  extractor: Extractor;
  urlPortal: string;
};

async function remitenteDe(sesion: Sesion, repo: Repositorio): Promise<{ canal: Canal; remitente: Remitente }> {
  if (sesion.rol !== "proveedor") return { canal: "carga_manual", remitente: { tipo: "interno", valor: sesion.correo } };
  const { beneficiarios } = await repo.datosComunes();
  const b = beneficiarios.find((x) => x.id === sesion.beneficiario_id);
  if (!b) throw new ErrorSubida(403, "Tu usuario no está asociado a un proveedor.");
  // Sin usuario de portal registrado, el remitente es el correo de la sesión: R11 escala y pide vincular.
  return { canal: "portal", remitente: { tipo: "portal", valor: b.canales.portal_usuario ?? sesion.correo } };
}

export async function subirDocumento(
  archivo: { bytes: Uint8Array; nombre: string },
  sesion: Sesion,
  deps: DependenciasSubida,
): Promise<ResultadoSubida> {
  const v = validarArchivo(archivo.bytes);
  if (!v.ok) throw new ErrorSubida(v.estado, v.mensaje);

  const { canal, remitente } = await remitenteDe(sesion, deps.repo);
  const bytes = Buffer.from(archivo.bytes.buffer, archivo.bytes.byteOffset, archivo.bytes.byteLength);
  const entrada: DocumentoEntrante = {
    canal,
    remitente,
    recibido_en: deps.ahora,
    adjuntos: [{ nombre: sanearNombre(archivo.nombre), mime: v.mime, bytes_base64: bytes.toString("base64") }],
  };
  // Se guarda con nombre generado; el nombre original queda solo como metadato saneado del adjunto.
  const original = { nombre: `${sha256(bytes)}.${v.extension}`, mime: v.mime, bytes };
  const doc = await ingerir(entrada, { repo: deps.repo, reloj: { ahora: () => deps.ahora }, original });
  const e = await procesarDocumento(doc.ref_interna, { repo: deps.repo, ahora: deps.ahora, extractor: deps.extractor });
  const decision = e.decision as DecisionAgente;
  const mensaje =
    sesion.rol === "proveedor" ? textoRespuesta(e, e.extraccion?.idioma ?? "es", { urlPortal: deps.urlPortal }) : e.explicacion;
  return { ref_interna: e.ref_interna, estado: decision, mensaje };
}
