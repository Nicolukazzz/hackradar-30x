// Arma la entrada del motor en modo "golden" (§14): documentos del escenario + extraccion_esperada.
// Lo usan la API (#17: procesar el lote demo y simular reglas) y la evaluación (#7).

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { cargarDatosComunes, cargarEscenario, type DatosComunes, reglasVersion, type Escenario } from "@/dominio/cargar";
import type {
  Beneficiario,
  Campo,
  DocumentoRecibido,
  EsperadoDocumento,
  Extraccion,
  ExtraccionPlana,
  Formato,
  MetaDocumento,
  Reglas,
} from "@/dominio/tipos";

export type DocGolden = { doc: DocumentoRecibido; ext: Extraccion; esperado: EsperadoDocumento };

export type EscenarioGolden = {
  datos: DatosComunes;
  escenario: Escenario;
  reglas: Reglas;
  docs: DocGolden[];
};

function campo<T>(valor: T | null, confianza = 1): Campo<T> {
  return { valor, confianza, fuente: "parser" };
}

/** ExtraccionPlana (esperado.json) → Extraccion con confianza 1 en cada campo. */
export function extraccionDesdePlana(plana: ExtraccionPlana, texto_crudo: string): Extraccion {
  const ext: Extraccion = {
    es_factura: campo(plana.es_factura),
    beneficiario_nombre: campo(plana.beneficiario_nombre),
    numero: campo(plana.numero),
    monto_total: campo(plana.monto_total),
    fecha_emision: campo(plana.fecha_emision),
    fecha_vencimiento: campo(plana.fecha_vencimiento),
    cuenta_destino_ultimos4: campo(plana.cuenta_destino_ultimos4),
    concepto: campo(plana.concepto),
    idioma: plana.idioma,
    texto_crudo,
    senales_llm: { instrucciones_sospechosas: [] },
    proveedor_llm: "ninguno",
  };
  if (plana.subtotal) ext.subtotal = campo(plana.subtotal);
  if (plana.impuestos) ext.impuestos = campo(plana.impuestos);
  if (plana.referencia_acuerdo) ext.referencia_acuerdo = campo(plana.referencia_acuerdo);
  if (plana.hito_numero !== undefined) ext.hito_numero = campo(plana.hito_numero);
  return ext;
}

function formatoDe(meta: MetaDocumento): Formato {
  const ext = meta.archivo_original.split(".").at(-1);
  if (ext === "eml") return "correo";
  if (ext === "txt") return "chat";
  if (ext === "png" || ext === "jpg") return "imagen";
  if (ext === "xml") return "xml";
  return "pdf";
}

/** Igual que la ingesta (#11): qué beneficiario tiene vinculado este remitente. */
export function beneficiarioDelRemitente(meta: MetaDocumento, beneficiarios: Beneficiario[]): string | null {
  const { tipo, valor } = meta.remitente;
  const b = beneficiarios.find((x) => {
    if (tipo === "correo") return x.canales.correos.some((c) => c.toLowerCase() === valor.toLowerCase());
    if (tipo === "telegram") return x.canales.telegram_chat_id === valor;
    if (tipo === "portal") return x.canales.portal_usuario === valor;
    return false;
  });
  return b?.id ?? null;
}

async function sha256De(meta: MetaDocumento, carpeta: string): Promise<string> {
  const principal = meta.adjuntos[0];
  const bytes = principal?.ruta
    ? await readFile(path.join(carpeta, principal.ruta))
    : Buffer.from(meta.texto_mensaje ?? "", "utf8");
  return createHash("sha256").update(bytes).digest("hex");
}

export async function cargarGolden(id: string, dir?: string): Promise<EscenarioGolden> {
  const [datos, escenario] = await Promise.all([cargarDatosComunes(dir), cargarEscenario(id, dir)]);
  const docs = await Promise.all(
    escenario.documentos.map(async (meta): Promise<DocGolden> => {
      const { archivo_original, ...entrante } = meta;
      const esperado = escenario.esperado.find((e) => e.documento === archivo_original);
      if (!esperado) throw new Error(`sin esperado para ${archivo_original}`);
      const doc: DocumentoRecibido = {
        ...entrante,
        ref_interna: esperado.ref_esperada,
        sha256: await sha256De(meta, escenario.carpeta),
        formato: formatoDe(meta),
        beneficiario_remitente_id: beneficiarioDelRemitente(meta, datos.beneficiarios),
      };
      const texto = [meta.asunto, meta.texto_mensaje].filter(Boolean).join("\n");
      return { doc, ext: extraccionDesdePlana(esperado.extraccion_esperada, texto), esperado };
    }),
  );
  return { datos, escenario, reglas: reglasVersion(datos, escenario.config.reglas_version), docs };
}
