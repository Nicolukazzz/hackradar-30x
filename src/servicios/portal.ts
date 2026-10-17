// "Tus facturas" del portal de proveedores (#12). Lo usan la página /portal y GET /api/portal/facturas.
// El proveedor solo ve lo que envió desde un canal vinculado a SU beneficiario, y solo con textos
// pensados para él: nunca límites, presupuesto, reglas internas ni comentarios de los aprobadores.

import { instante } from "@/dominio/reloj";
import type { Dinero, EntradaRegistro, Idioma } from "@/dominio/tipos";
import { textoRespuesta } from "@/ingesta/respuesta";
import { resoluciones } from "@/reglas/libro";
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

/** Recibida pero todavía sin decisión del agente (p. ej. falló la revisión y quedó para finanzas). */
const TEXTO_SIN_DECISION = "Recibida. El equipo de finanzas la revisará; no hace falta enviarla de nuevo.";

function estadoAgente(e: EntradaRegistro): EstadoProveedor {
  if (e.decision === "PAGAR") return "aprobada";
  if (e.decision === "FRENAR") return "no_se_pagara";
  if (e.decision === "RECHAZADA_NO_FACTURA") return "no_es_factura";
  return "en_revision";
}

/**
 * Facturas del beneficiario, más nuevas primero. `beneficiario_id` sale de la sesión, nunca de la petición.
 * Parte de los documentos recibidos (no del registro): así aparece también lo recibido y aún sin decidir.
 * El historial importado de antes del sistema no tiene documento y no se muestra.
 */
export async function facturasDelProveedor(
  repo: Repositorio,
  beneficiario_id: string,
  opciones: { urlPortal: string; idioma?: Idioma },
): Promise<FacturaProveedor[]> {
  const idioma = opciones.idioma ?? "es"; // la página está en español: los textos también
  const [documentos, registro] = await Promise.all([repo.documentos(), repo.registro({ tipo: ["DECISION_AGENTE", "DECISION_HUMANA"] })]);
  const agentePorRef = new Map(registro.filter((e) => e.tipo === "DECISION_AGENTE").map((e) => [e.ref_interna, e]));
  const humana = resoluciones(registro);

  return documentos
    .filter((d) => d.beneficiario_remitente_id === beneficiario_id)
    .map((d): FacturaProveedor => {
      const e = agentePorRef.get(d.ref_interna);
      if (!e) {
        return { ref_interna: d.ref_interna, factura_numero: null, recibida_en: d.recibido_en, monto: null, estado: "en_revision", detalle: TEXTO_SIN_DECISION };
      }
      const resuelta = humana.get(e.id);
      const base = { ref_interna: e.ref_interna, factura_numero: e.factura_numero, recibida_en: d.recibido_en, monto: e.monto_original };
      if (resuelta) return { ...base, estado: resuelta === "APROBADA_HUMANO" ? "aprobada" : "no_se_pagara", detalle: TEXTO_HUMANO[resuelta] };
      return { ...base, estado: estadoAgente(e), detalle: textoRespuesta(e, idioma, { urlPortal: opciones.urlPortal }) };
    })
    .sort((a, b) => instante(b.recibida_en) - instante(a.recibida_en) || b.ref_interna.localeCompare(a.ref_interna));
}
