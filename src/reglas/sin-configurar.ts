// Reglas de una empresa que todavía no guardó las suyas (#106). Producción arranca sin datos de ejemplo: hasta que el
// admin guarde la versión 1, el motor escala toda factura (nunca paga ni frena sola). Los valores son solo la sugerencia
// que la pantalla de reglas muestra para empezar; nunca deciden un pago.

import type { Reglas } from "@/dominio/tipos";

export const VERSION_SIN_CONFIGURAR = 0;

export function reglasSinConfigurar(): Reglas {
  return {
    version: VERSION_SIN_CONFIGURAR,
    editada_por: "Sin configurar",
    editada_en: "2026-01-01T00:00:00-05:00",
    limites: {
      pago_automatico_usd: 300000,
      maximo_absoluto_usd: 1500000,
      mensual_por_beneficiario_default_usd: 300000,
      tolerancia_acordado_pct: 2,
    },
    presupuesto: { periodo: "mensual", monto_usd: 6000000, contar_escalado_como_reservado: true },
    duplicados: { ventana_dias: 45, tolerancia_monto_pct: 1, tolerancia_fecha_dias: 7 },
    extraccion: { confianza_minima: 0.9 },
    aprobacion: { doble_aprobacion_desde_usd: 1000000 },
    activas: { R1: true, R2: true, R3: true, R4: true, R5: true, R6: true, R7: true, R8: true, R9: true, R10: true, R11: true },
  };
}

export const sinConfigurar = (r: Pick<Reglas, "version">): boolean => r.version === VERSION_SIN_CONFIGURAR;
