// Subida de un archivo desde el panel ("Cargar factura", carga manual) (#26; desde #49 sin portal de proveedores).
// Valida el tipo real, arma el DocumentoEntrante con el remitente que dice la SESIÓN (nunca el cuerpo)
// y lo pasa por la ingesta única (#11): ref, hash, extracción, motor y registro.

import type { Canal, DecisionAgente, DocumentoEntrante, Remitente } from "@/dominio/tipos";
import { ingerir, sha256 } from "@/ingesta/ingerir";
import { type Extractor, procesarDocumento } from "@/ingesta/pipeline";
import { sanearNombre, validarArchivo } from "@/ingesta/validar-archivo";
import type { Sesion } from "@/lib/auth/permisos";
import type { Repositorio } from "@/repositorio/repositorio";

export class ErrorSubida extends Error {
  constructor(
    readonly estado: 400 | 403 | 413 | 415 | 422 | 429 | 503,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorSubida";
  }
}

export type ResultadoSubida = {
  ref_interna: string;
  estado: DecisionAgente;
  /** La explicación completa del agente. */
  mensaje: string;
};

export type DependenciasSubida = {
  repo: Repositorio;
  ahora: string;
  extractor: Extractor;
};

/** #49: quien sube es una cuenta del equipo (carga manual); el remitente es su correo, tomado de la sesión. */
function remitenteDe(sesion: Sesion): { canal: Canal; remitente: Remitente } {
  return { canal: "carga_manual", remitente: { tipo: "interno", valor: sesion.correo } };
}

/**
 * Ya ingerido, el documento tiene que quedar decidido. Un fallo pasajero (repositorio) se reintenta una vez;
 * si vuelve a fallar se avisa con la ref, para que finanzas lo encuentre, en vez de un "no se registró nada".
 */
async function decidirConReintento(ref: string, deps: DependenciasSubida) {
  const pipeline = { repo: deps.repo, ahora: deps.ahora, extractor: deps.extractor };
  try {
    return await procesarDocumento(ref, pipeline);
  } catch {
    const ya = (await deps.repo.registro({ ref_interna: ref, tipo: ["DECISION_AGENTE"] }))[0];
    if (ya) return ya; // otra petición ya lo decidió
    try {
      return await procesarDocumento(ref, pipeline);
    } catch {
      throw new ErrorSubida(
        503,
        `Recibimos el archivo con la referencia ${ref}, pero el agente no pudo revisarlo ahora. El equipo de finanzas lo revisará; no hace falta enviarlo de nuevo.`,
      );
    }
  }
}

export async function subirDocumento(
  archivo: { bytes: Uint8Array; nombre: string },
  sesion: Sesion,
  deps: DependenciasSubida,
): Promise<ResultadoSubida> {
  const v = validarArchivo(archivo.bytes);
  if (!v.ok) throw new ErrorSubida(v.estado, v.mensaje);

  const { canal, remitente } = remitenteDe(sesion);
  const bytes = Buffer.from(archivo.bytes.buffer, archivo.bytes.byteOffset, archivo.bytes.byteLength); // sin copiar
  const entrada: DocumentoEntrante = {
    canal,
    remitente,
    recibido_en: deps.ahora,
    adjuntos: [{ nombre: sanearNombre(archivo.nombre), mime: v.mime, bytes_base64: bytes.toString("base64") }],
  };
  // Se guarda con nombre generado; el nombre original queda solo como metadato saneado del adjunto.
  const original = { nombre: `${sha256(bytes)}.${v.extension}`, mime: v.mime, bytes };
  const doc = await ingerir(entrada, { repo: deps.repo, reloj: { ahora: () => deps.ahora }, original });
  const e = await decidirConReintento(doc.ref_interna, deps);
  const decision = e.decision as DecisionAgente;
  return { ref_interna: e.ref_interna, estado: decision, mensaje: e.explicacion };
}
