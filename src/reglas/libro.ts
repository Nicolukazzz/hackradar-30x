// Facturas vigentes (pagadas o reservadas) derivadas del registro append-only.
// R2 (duplicados), R8 (mensual por beneficiario) y el presupuesto (§6) leen de aquí,
// así el historial importado y las decisiones del lote se tratan igual.

import { normalizarNombre, normalizarNumeroFactura } from "@/dominio/normalizar";
import type { EntradaRegistro, TipoPeriodo } from "@/dominio/tipos";

export type EstadoFactura = "pagada" | "reservada";

export type FacturaVigente = {
  /** id de la DECISION_AGENTE */
  id: string;
  momento: string;
  ref_interna: string;
  /** nombre normalizado (normalizarNombre) */
  beneficiario: string;
  numero: string | null;
  numero_normalizado: string | null;
  fecha_emision: string | null;
  usd_centavos: number;
  sha256: string | null;
  hito: number | null;
  estado: EstadoFactura;
};

/**
 * PAGAR → pagada. ESCALAR → reservada hasta que una persona resuelve:
 * APROBADA_HUMANO → pagada, RECHAZADA_HUMANO → deja de contar. La primera de dos firmas (decision null) no resuelve.
 */
export function facturasVigentes(historial: readonly EntradaRegistro[]): FacturaVigente[] {
  const resolucion = new Map<string, "APROBADA_HUMANO" | "RECHAZADA_HUMANO">();
  for (const e of historial) {
    if (e.tipo !== "DECISION_HUMANA" || !e.entrada_origen) continue;
    if (e.decision === "APROBADA_HUMANO" || e.decision === "RECHAZADA_HUMANO") resolucion.set(e.entrada_origen, e.decision);
  }

  const vigentes: FacturaVigente[] = [];
  for (const e of historial) {
    if (e.tipo !== "DECISION_AGENTE") continue;
    let estado: EstadoFactura | null = null;
    if (e.decision === "PAGAR") estado = "pagada";
    else if (e.decision === "ESCALAR") {
      const r = resolucion.get(e.id);
      if (r === undefined) estado = "reservada";
      else if (r === "APROBADA_HUMANO") estado = "pagada";
    }
    if (estado === null) continue;
    vigentes.push({
      id: e.id,
      momento: e.momento,
      ref_interna: e.ref_interna,
      // Sin nombre legible igual cuenta en el presupuesto; no coincide con ningún beneficiario en R2/R8.
      beneficiario: e.beneficiario ? normalizarNombre(e.beneficiario) : "",
      numero: e.factura_numero,
      numero_normalizado: e.factura_numero ? normalizarNumeroFactura(e.factura_numero) : null,
      fecha_emision: e.extraccion?.fecha_emision.valor ?? null,
      usd_centavos: e.monto_usd_centavos ?? 0,
      sha256: e.sha256,
      hito: e.extraccion?.hito_numero?.valor ?? null,
      estado,
    });
  }
  return vigentes;
}

/** Id del periodo de presupuesto de un momento: "2026-10" · "2026-10-Q2" · "2026-T4". */
export function periodoDe(momento: string, tipo: TipoPeriodo = "mensual"): string {
  const mes = momento.slice(0, 7);
  if (tipo === "mensual") return mes;
  if (tipo === "quincenal") return `${mes}-Q${Number(momento.slice(8, 10)) <= 15 ? 1 : 2}`;
  return `${momento.slice(0, 4)}-T${Math.ceil(Number(momento.slice(5, 7)) / 3)}`;
}

/** Suma USD de facturas en un estado, dentro del periodo (y de un beneficiario, si se da). */
export function totalEn(
  vigentes: readonly FacturaVigente[],
  periodo: string,
  tipo: TipoPeriodo,
  estado: EstadoFactura,
  beneficiario?: string,
): number {
  return vigentes
    .filter((f) => f.estado === estado && periodoDe(f.momento, tipo) === periodo)
    .filter((f) => beneficiario === undefined || f.beneficiario === beneficiario)
    .reduce((s, f) => s + f.usd_centavos, 0);
}
