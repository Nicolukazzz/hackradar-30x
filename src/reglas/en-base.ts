// #86: montos de decisiones tomadas con otra moneda base (antes de cambiarla) en la moneda base de hoy. Para mostrar,
// sumar y comparar con límites que ya están en la base nueva: nunca se suman ni se comparan monedas distintas.
// Sin reloj: `ahora` llega inyectado.

import type { DatosComunes } from "@/dominio/cargar";
import Decimal from "decimal.js";

import { aBase, monedaBase } from "@/dominio/dinero";
import type { EntradaRegistro, Moneda, Reglas, TablaTasas } from "@/dominio/tipos";

import { fechaDe } from "./fechas";

/** Tasas de hoy: la foto diaria más reciente hasta hoy; sin fotos diarias (dataset), la tabla del periodo. */
export function tablaDeHoy(datos: Pick<DatosComunes, "tasas" | "tasas_diarias">, reglas: Pick<Reglas, "moneda">, ahora: string): TablaTasas {
  const diarias = datos.tasas_diarias;
  const hoy = fechaDe(ahora);
  const ultima = diarias ? Object.keys(diarias).filter((f) => f <= hoy).sort((a, b) => a.localeCompare(b)).at(-1) : undefined;
  if (diarias && ultima) return diarias[ultima]!;
  const periodo = ahora.slice(0, 7);
  return datos.tasas[periodo] ?? { periodo, base: monedaBase(reglas), tasas: {} };
}

/** Monto de la entrada en `base`, o null si está en otra moneda y no hay tasa para convertirlo. */
export function montoEnBase(e: Pick<EntradaRegistro, "monto_usd_centavos" | "moneda_base">, base: Moneda, tabla: TablaTasas): number | null {
  if (e.monto_usd_centavos === null) return null;
  const de = e.moneda_base ?? "USD";
  if (de === base || e.monto_usd_centavos === 0) return e.monto_usd_centavos;
  try {
    if (tabla.base === base) return aBase({ centavos: e.monto_usd_centavos, moneda: de }, tabla).base_centavos;
    // Tabla en la moneda vieja (1 USD = 4.000 COP): se multiplica.
    const tasa = tabla.base === de ? tabla.tasas[base] : undefined;
    if (!tasa) return null;
    return new Decimal(e.monto_usd_centavos).times(tasa).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  } catch {
    return null;
  }
}

/**
 * Las entradas con su monto en la moneda base de hoy (`moneda_base` = la de hoy). Si una no se puede convertir, queda
 * como estaba (con su moneda): la pantalla la muestra en su moneda y las sumas la dejan fuera.
 */
export function enBaseDeHoy(
  registro: readonly EntradaRegistro[],
  datos: Pick<DatosComunes, "tasas" | "tasas_diarias">,
  reglas: Pick<Reglas, "moneda">,
  ahora: string,
  /** tasas del día de la fuente (producción); si no hay, las de los datos */
  delDia: TablaTasas | null = null,
): EntradaRegistro[] {
  const base = monedaBase(reglas);
  if (registro.every((e) => (e.moneda_base ?? "USD") === base || e.monto_usd_centavos === null)) return [...registro];
  const tabla = delDia ?? tablaDeHoy(datos, reglas, ahora);
  return registro.map((e) => {
    if ((e.moneda_base ?? "USD") === base || e.monto_usd_centavos === null) return e;
    const monto = montoEnBase(e, base, tabla);
    return monto === null ? e : { ...e, monto_usd_centavos: monto, moneda_base: base };
  });
}
