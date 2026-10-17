// "Mis facturas" del portal de proveedores (#12). Lo usan la página /portal y GET /api/portal/facturas.
// El proveedor solo ve lo que envió desde un canal vinculado a SU beneficiario, y solo con textos
// pensados para él: nunca límites, presupuesto, reglas internas ni comentarios de los aprobadores.

import type { Dinero, EntradaRegistro, Idioma } from "@/dominio/tipos";
import { textoRespuesta } from "@/ingesta/respuesta";
import type { Repositorio } from "@/repositorio/repositorio";

export type EstadoProveedor = "aprobada" | "en_revision" | "no_se_pagara" | "no_es_factura";

export type FacturaProveedor = {
  ref_interna: string;
  factura_numero: string | null;
  recibida_en: string;
  monto: Dinero | null;
  estado: EstadoProveedor;
  /** frase para el proveedor (respuesta.ts o la resolución humana), sin reglas internas */
  detalle: string;
};

const TEXTO_HUMANO = {
  APROBADA_HUMANO: "El equipo de finanzas aprobó esta factura para pago.",
  RECHAZADA_HUMANO: "El equipo de finanzas revisó esta factura y no se pagará. Te contactarán si necesitan algo más.",
} as const;

function estadoAgente(e: EntradaRegistro): EstadoProveedor {
  if (e.decision === "PAGAR") return "aprobada";
  if (e.decision === "FRENAR") return "no_se_pagara";
  if (e.decision === "RECHAZADA_NO_FACTURA") return "no_es_factura";
  return "en_revision";
}

/** Facturas del beneficiario, más nuevas primero. `beneficiario_id` sale de la sesión, nunca de la petición. */
export async function facturasDelProveedor(
  repo: Repositorio,
  beneficiario_id: string,
  opciones: { urlPortal: string; idioma?: Idioma },
): Promise<FacturaProveedor[]> {
  const registro = await repo.registro();
  const humanas = new Map<string, EntradaRegistro>();
  for (const e of registro) {
    if (e.tipo === "DECISION_HUMANA" && e.entrada_origen && (e.decision === "APROBADA_HUMANO" || e.decision === "RECHAZADA_HUMANO")) {
      humanas.set(e.entrada_origen, e);
    }
  }

  const filas: FacturaProveedor[] = [];
  for (const e of registro) {
    if (e.tipo !== "DECISION_AGENTE") continue;
    const doc = await repo.documento(e.ref_interna);
    if (!doc || doc.beneficiario_remitente_id !== beneficiario_id) continue;
    const humana = humanas.get(e.id);
    const idioma = opciones.idioma ?? e.extraccion?.idioma ?? "es";
    let estado = estadoAgente(e);
    let detalle = textoRespuesta(e, idioma, { urlPortal: opciones.urlPortal });
    if (humana?.decision === "APROBADA_HUMANO" || humana?.decision === "RECHAZADA_HUMANO") {
      estado = humana.decision === "APROBADA_HUMANO" ? "aprobada" : "no_se_pagara";
      detalle = TEXTO_HUMANO[humana.decision];
    }
    filas.push({ ref_interna: e.ref_interna, factura_numero: e.factura_numero, recibida_en: doc.recibido_en, monto: e.monto_original, estado, detalle });
  }
  return filas.sort((a, b) => b.recibida_en.localeCompare(a.recibida_en) || b.ref_interna.localeCompare(a.ref_interna));
}
