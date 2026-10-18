// Reglas de una empresa que todavía no guardó las suyas (#106). Producción arranca sin datos de ejemplo: hasta que el
// admin guarde la versión 1, el motor escala toda factura (nunca paga ni frena sola). Los valores son solo la sugerencia
// que la pantalla de reglas muestra para empezar; nunca deciden un pago.

import { ID_REGLAS, type IdRegla, type Moneda, type Reglas } from "@/dominio/tipos";

/** Versión de las reglas que nunca se guarda: significa «la empresa aún no configuró nada». */
export const VERSION_SIN_CONFIGURAR = 0;

/** Dólares → centavos (los límites se guardan en centavos). */
const usd = (dolares: number) => dolares * 100;

/** Reglas sugeridas en USD, versión 0. Con ellas el motor evalúa y explica, pero siempre escala. */
export function reglasSinConfigurar(): Reglas {
  return {
    version: VERSION_SIN_CONFIGURAR,
    editada_por: "Sin configurar",
    editada_en: "2026-01-01T00:00:00-05:00",
    // Sugeridos: pago automático hasta USD 3.000, máximo USD 15.000 por pago, presupuesto mensual USD 60.000.
    limites: {
      pago_automatico_usd: usd(3_000),
      maximo_absoluto_usd: usd(15_000),
      mensual_por_beneficiario_default_usd: usd(3_000),
      tolerancia_acordado_pct: 2,
    },
    presupuesto: { periodo: "mensual", monto_usd: usd(60_000), contar_escalado_como_reservado: true },
    duplicados: { ventana_dias: 45, tolerancia_monto_pct: 1, tolerancia_fecha_dias: 7 },
    extraccion: { confianza_minima: 0.9 },
    aprobacion: { doble_aprobacion_desde_usd: usd(10_000) },
    activas: Object.fromEntries(ID_REGLAS.map((id) => [id, true])) as Record<IdRegla, boolean>,
  };
}

/**
 * #86: las sugeridas en la moneda base de la empresa. `desdeUsd` convierte centavos de USD a esa moneda (con la tasa del
 * día); los valores se redondean a unidades para que se lean bien.
 */
export function reglasSinConfigurarEn(moneda: Moneda, desdeUsd: (centavos: number) => number): Reglas {
  const r = reglasSinConfigurar();
  if (moneda === "USD") return r;
  const c = (centavos: number) => Math.round(desdeUsd(centavos) / 100) * 100;
  return {
    ...r,
    moneda,
    limites: {
      ...r.limites,
      pago_automatico_usd: c(r.limites.pago_automatico_usd),
      maximo_absoluto_usd: c(r.limites.maximo_absoluto_usd),
      mensual_por_beneficiario_default_usd: c(r.limites.mensual_por_beneficiario_default_usd),
    },
    presupuesto: { ...r.presupuesto, monto_usd: c(r.presupuesto.monto_usd) },
    aprobacion: { doble_aprobacion_desde_usd: c(r.aprobacion.doble_aprobacion_desde_usd) },
  };
}

/** true si son las reglas sin configurar (versión 0): el motor escala toda factura. */
export const sinConfigurar = (r: Pick<Reglas, "version">): boolean => r.version === VERSION_SIN_CONFIGURAR;
