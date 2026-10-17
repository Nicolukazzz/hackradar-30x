// Helpers de test: documento del dataset → DocumentoRecibido, y Extraccion → forma plana de esperado.json.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { DocumentoRecibido, Extraccion, ExtraccionPlana, Formato, MetaDocumento } from "@/dominio/tipos";

const FORMATO_POR_EXTENSION: Record<string, Formato> = { ".pdf": "pdf", ".eml": "correo", ".txt": "chat", ".png": "imagen", ".xml": "xml" };

export async function recibido(meta: MetaDocumento, carpeta: string, n: number): Promise<DocumentoRecibido> {
  const { archivo_original, ...entrante } = meta;
  const principal = meta.adjuntos[0]?.ruta;
  const bytes = principal ? await readFile(path.join(carpeta, principal)) : Buffer.from(meta.texto_mensaje ?? "", "utf8");
  return {
    ...entrante,
    ref_interna: `INT-2026-${n.toString().padStart(6, "0")}`,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    formato: FORMATO_POR_EXTENSION[path.extname(archivo_original)] ?? "pdf",
    beneficiario_remitente_id: null,
  };
}

export function aPlana(e: Extraccion): ExtraccionPlana {
  const p: ExtraccionPlana = {
    es_factura: e.es_factura.valor ?? false,
    beneficiario_nombre: e.beneficiario_nombre.valor,
    numero: e.numero.valor,
    monto_total: e.monto_total.valor,
    fecha_emision: e.fecha_emision.valor,
    fecha_vencimiento: e.fecha_vencimiento.valor,
    cuenta_destino_ultimos4: e.cuenta_destino_ultimos4.valor,
    concepto: e.concepto.valor,
    idioma: e.idioma,
  };
  if (e.subtotal?.valor) p.subtotal = e.subtotal.valor;
  if (e.impuestos?.valor) p.impuestos = e.impuestos.valor;
  if (e.referencia_acuerdo?.valor) p.referencia_acuerdo = e.referencia_acuerdo.valor;
  if (e.hito_numero?.valor) p.hito_numero = e.hito_numero.valor;
  return p;
}
