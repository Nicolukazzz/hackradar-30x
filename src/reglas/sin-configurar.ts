// Reglas de una empresa que todavía no guardó las suyas (#106). Producción arranca sin datos de ejemplo: hasta que el
// admin guarde la versión 1, el motor escala toda factura (nunca paga ni frena sola). Los valores son solo la sugerencia
// que la pantalla de reglas muestra para empezar; nunca deciden un pago.

import { ID_REGLAS, type IdRegla, type Reglas } from "@/dominio/tipos";

export const VERSION_SIN_CONFIGURAR = 0;

/** Dólares → centavos (los límites se guardan en centavos). */
const usd = (dolares: number) => dolares * 100;

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

export const sinConfigurar = (r: Pick<Reglas, "version">): boolean => r.version === VERSION_SIN_CONFIGURAR;
