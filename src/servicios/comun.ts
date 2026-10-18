// Piezas compartidas por los servicios que arman las respuestas de §12.

import { instante } from "@/dominio/reloj";
import type { DatosComunes } from "@/dominio/cargar";
import { aBase } from "@/dominio/dinero";
import type { Beneficiario, DecisionAgente, DecisionHumana, Dinero, EntradaRegistro, Reglas } from "@/dominio/tipos";
import { tasasDeLaFactura } from "@/reglas/motor";
import { estadoHumano } from "@/aprobaciones/decidir";
import { relojSistema } from "@/lib/reloj-sistema";
import type { Repositorio } from "@/repositorio/repositorio";

/** Estado visible de una factura: la decisión del agente o, si una persona ya resolvió, la suya. */
export type EstadoFactura = DecisionAgente | DecisionHumana;

/** Entradas del agente que son del lote (no del historial importado), en orden de proceso. */
export async function entradasDelLote(repo: Repositorio): Promise<{ registro: EntradaRegistro[]; lote: EntradaRegistro[] }> {
  const [registro, esc] = await Promise.all([repo.registro(), repo.escenario()]);
  const importadas = esc?.entradas_importadas ?? 0;
  const lote = registro.slice(importadas).filter((e) => e.tipo === "DECISION_AGENTE");
  return { registro, lote };
}

export function estadoActual(registro: readonly EntradaRegistro[], agente: EntradaRegistro): { estado: EstadoFactura; firmas: number } {
  const { final, firmas } = estadoHumano(registro, agente);
  const estado = (final?.decision as DecisionHumana | undefined) ?? (agente.decision as DecisionAgente);
  return { estado, firmas: firmas.length };
}

const PAISES: Record<string, string> = {
  US: "EE. UU.", CO: "Colombia", MX: "México", AR: "Argentina", BR: "Brasil", CL: "Chile", PA: "Panamá", PE: "Perú",
};

export function nombrePais(codigo: string | null | undefined): string | null {
  return codigo ? (PAISES[codigo] ?? null) : null;
}

/** "Colombia · contratista" · "Chile · nuevo" (fila de la Bandeja, §13.1). */
export function descripcionBeneficiario(b: Beneficiario | null, paisFueraDeLista: string | null): string {
  if (!b) return [paisFueraDeLista, "nuevo"].filter(Boolean).join(" · ");
  return [nombrePais(b.pais), b.tipo].filter(Boolean).join(" · ");
}

/**
 * Hora de una decisión humana: el reloj real, pero nunca antes del lote del escenario
 * (la demo vive en el 16-oct-2026 aunque se presente otro día).
 */
export async function ahoraHumano(repo: Repositorio): Promise<string> {
  const real = relojSistema().ahora();
  const esc = await repo.escenario();
  if (esc && instante(real) < instante(esc.config.ahora)) return esc.config.ahora;
  return real;
}

/**
 * #141: un total que el agente leyó sin confianza (monto_usd null), convertido a la moneda base igual que los seguros,
 * para mostrarlo en las listas (en naranja). Solo para mostrar: nunca entra a reglas ni presupuesto. null si no hay
 * total leído o no hay tasa para convertirlo.
 */
export function montoEstimado(e: EntradaRegistro, datos: DatosComunes, reglas: Reglas): Dinero | null {
  if (e.monto_usd_centavos !== null || !e.monto_original || !e.extraccion) return null;
  try {
    const { tabla } = tasasDeLaFactura(datos, reglas, e.momento, e.extraccion);
    return { centavos: aBase(e.monto_original, tabla).base_centavos, moneda: tabla.base };
  } catch {
    return null;
  }
}
