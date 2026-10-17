// Presupuesto del periodo con reservas (especificación §6).
// disponible = presupuesto − pagado_antes − pagado_en_lote − reservado

import { normalizarNombre } from "@/dominio/normalizar";
import type { DecisionAgente, EntradaRegistro, Reglas, TipoPeriodo } from "@/dominio/tipos";

import { facturasVigentes, totalEn } from "./libro";

export type EstadoPresupuesto = {
  /** "2026-10" (ver periodoDe) */
  periodo: string;
  tipo: TipoPeriodo;
  presupuesto: number;
  pagado_antes: number;
  pagado_en_lote: number;
  /** ESCALAR pendientes (0 si contar_escalado_como_reservado = false) */
  reservado: number;
  contar_reservado: boolean;
  disponible: number;
};

function conDisponible(e: Omit<EstadoPresupuesto, "disponible">): EstadoPresupuesto {
  const reservado = e.contar_reservado ? e.reservado : 0;
  return { ...e, disponible: e.presupuesto - e.pagado_antes - e.pagado_en_lote - reservado };
}

/** Estado al empezar un lote, a partir del registro previo. */
export function estadoInicial(historial: readonly EntradaRegistro[], reglas: Reglas, periodo: string): EstadoPresupuesto {
  const tipo = reglas.presupuesto.periodo;
  const vigentes = facturasVigentes(historial);
  return conDisponible({
    periodo,
    tipo,
    presupuesto: reglas.presupuesto.monto_usd,
    pagado_antes: totalEn(vigentes, periodo, tipo, "pagada"),
    pagado_en_lote: 0,
    reservado: totalEn(vigentes, periodo, tipo, "reservada"),
    contar_reservado: reglas.presupuesto.contar_escalado_como_reservado,
  });
}

/** PAGAR suma a pagado; ESCALAR suma a reservado al instante. FRENAR y RECHAZADA no cambian nada. */
export function aplicar(estado: EstadoPresupuesto, decision: DecisionAgente, usd_centavos: number | null): EstadoPresupuesto {
  const monto = usd_centavos ?? 0;
  if (decision === "PAGAR") return conDisponible({ ...estado, pagado_en_lote: estado.pagado_en_lote + monto });
  if (decision === "ESCALAR") return conDisponible({ ...estado, reservado: estado.reservado + monto });
  return estado;
}

/** Pagado + reservado de un beneficiario en el periodo (R8). */
export function porBeneficiario(
  historial: readonly EntradaRegistro[],
  periodo: string,
  tipo: TipoPeriodo,
  nombre: string,
): number {
  const vigentes = facturasVigentes(historial);
  const ben = normalizarNombre(nombre);
  return totalEn(vigentes, periodo, tipo, "pagada", ben) + totalEn(vigentes, periodo, tipo, "reservada", ben);
}
