// Contexto común de las reglas (especificación §4.1) y datos derivados que varias reglas comparten.
// Todo es puro: sin I/O, sin reloj. `ahora` llega como dato.

import { aUsd, formatearNumero } from "@/dominio/dinero";
import type {
  Beneficiario,
  Dinero,
  DocumentoRecibido,
  EntradaRegistro,
  EvaluacionRegla,
  Extraccion,
  IdRegla,
  Moneda,
  Reglas,
  TablaTasas,
} from "@/dominio/tipos";

import { esFechaValida, fechaDe, fechaLegible } from "./fechas";
import type { EstadoPresupuesto } from "./presupuesto";

export type ContextoRegla = {
  doc: DocumentoRecibido;
  ext: Extraccion;
  reglas: Reglas;
  tasas: TablaTasas;
  /** match por nombre normalizado; null = no está en la lista */
  beneficiario: Beneficiario | null;
  /** cuántos beneficiarios activos tiene la lista (para el texto de R3) */
  total_permitidos: number;
  /** registro previo + decisiones anteriores del mismo lote */
  historial: EntradaRegistro[];
  presupuesto: EstadoPresupuesto;
  ahora: string;
};

/** Firma común (§4.1): función pura, sin I/O ni reloj. */
export type Regla = (ctx: ContextoRegla) => EvaluacionRegla;

export const CAMPOS_OBLIGATORIOS = [
  "beneficiario_nombre",
  "numero",
  "monto_total",
  "fecha_emision",
  "fecha_vencimiento",
  "cuenta_destino_ultimos4",
  "concepto",
] as const;
export type CampoObligatorio = (typeof CAMPOS_OBLIGATORIOS)[number];

export const ETIQUETA_CAMPO: Record<CampoObligatorio, string> = {
  beneficiario_nombre: "beneficiario",
  numero: "número de factura",
  monto_total: "monto total",
  fecha_emision: "fecha de emisión",
  fecha_vencimiento: "fecha de vencimiento",
  cuenta_destino_ultimos4: "cuenta destino",
  concepto: "concepto",
};

/** Texto de las reglas que dependen de un campo que R1 marcó. */
export const SIN_DATO = "sin dato confiable (ver R1)";
export const FUERA_DE_LISTA = "beneficiario fuera de la lista (ver R3)";

/** Monedas que se escriben sin decimales (igual que dinero.ts). */
const SIN_DECIMALES: ReadonlySet<Moneda> = new Set(["COP", "CLP"]);

/** Número en la moneda dada, sin código: COP → "5.350.000", USD → "1.250,00". */
export function numeroEn(d: Dinero): string {
  return formatearNumero(Math.abs(d.centavos), !SIN_DECIMALES.has(d.moneda) || d.centavos % 100 !== 0);
}

/** "94%" */
export function pctEntero(confianza: number): string {
  return `${Math.floor(confianza * 100)}%`;
}

export type Afectacion = { campo: CampoObligatorio; motivo: string };

/**
 * R1 (§4.3): campos faltantes, de baja confianza o que participan en una validación fallida.
 * El orden es estable (orden de CAMPOS_OBLIGATORIOS y luego validaciones) para que el texto sea reproducible.
 */
export function afectaciones(ctx: ContextoRegla): Afectacion[] {
  // Varias reglas lo piden para el mismo documento: se calcula una vez por contexto.
  const guardado = cache.get(ctx);
  if (guardado) return guardado;
  const lista = calcularAfectaciones(ctx);
  cache.set(ctx, lista);
  return lista;
}

const cache = new WeakMap<ContextoRegla, Afectacion[]>();

function calcularAfectaciones(ctx: ContextoRegla): Afectacion[] {
  const { ext, reglas, tasas } = ctx;
  const minima = reglas.extraccion.confianza_minima;
  const lista: Afectacion[] = [];
  const marcar = (campo: CampoObligatorio, motivo: string) => lista.push({ campo, motivo });

  for (const campo of CAMPOS_OBLIGATORIOS) {
    const c = ext[campo];
    if (c.valor === null || (typeof c.valor === "string" && c.valor.trim() === "")) {
      marcar(campo, `falta ${ETIQUETA_CAMPO[campo]}`);
    } else if (!(c.confianza >= minima)) {
      marcar(campo, `confianza de ${ETIQUETA_CAMPO[campo]} ${pctEntero(c.confianza)} < ${pctEntero(minima)}`);
    }
  }
  const ya = (campo: CampoObligatorio) => lista.some((a) => a.campo === campo);

  const total = ext.monto_total.valor;
  if (total && !ya("monto_total")) {
    if (!Number.isInteger(total.centavos) || total.centavos <= 0) marcar("monto_total", "el monto total no es mayor que 0");
    else if (total.moneda !== "USD" && tasas.tasas[total.moneda] === undefined)
      marcar("monto_total", `no hay tasa para ${total.moneda} en ${tasas.periodo}`);
    else if (aUsd(total, tasas).usd_centavos <= 0)
      // Encontrado por fast-check: COP 1 redondea a USD 0,00 y pasaría todos los límites.
      marcar("monto_total", `${numeroEn(total)} ${total.moneda} equivale a USD 0,00`);
    else {
      const sub = ext.subtotal?.valor;
      const imp = ext.impuestos?.valor;
      if (sub && imp) {
        const mismaMoneda = sub.moneda === total.moneda && imp.moneda === total.moneda;
        if (!mismaMoneda || sub.centavos + imp.centavos !== total.centavos) {
          marcar(
            "monto_total",
            `subtotal ${numeroEn(sub)} + impuestos ${numeroEn(imp)} ≠ total ${numeroEn(total)} ${total.moneda}`,
          );
        }
      }
    }
  }

  const emision = ext.fecha_emision.valor;
  const vence = ext.fecha_vencimiento.valor;
  const hoy = fechaDe(ctx.ahora);
  if (emision && !ya("fecha_emision")) {
    if (!esFechaValida(emision)) marcar("fecha_emision", `fecha de emisión inválida (${emision})`);
    else if (emision > hoy) marcar("fecha_emision", `fecha de emisión ${fechaLegible(emision)} posterior a hoy ${fechaLegible(hoy)}`);
  }
  if (vence && !ya("fecha_vencimiento")) {
    if (!esFechaValida(vence)) marcar("fecha_vencimiento", `fecha de vencimiento inválida (${vence})`);
    else if (emision && esFechaValida(emision) && vence < emision)
      marcar("fecha_vencimiento", `vence ${fechaLegible(vence)} antes de emitirse ${fechaLegible(emision)}`);
  }
  const cuenta = ext.cuenta_destino_ultimos4.valor;
  if (cuenta && !ya("cuenta_destino_ultimos4") && !/^\d{4}$/.test(cuenta)) {
    marcar("cuenta_destino_ultimos4", `cuenta destino ilegible (${cuenta})`);
  }
  return lista;
}

export function afectado(ctx: ContextoRegla, campo: CampoObligatorio): boolean {
  return afectaciones(ctx).some((a) => a.campo === campo);
}

/** Monto en centavos USD si el monto es confiable; null si R1 lo marcó. */
export function montoUsd(ctx: ContextoRegla): number | null {
  const total = ctx.ext.monto_total.valor;
  if (!total || afectado(ctx, "monto_total")) return null;
  return aUsd(total, ctx.tasas).usd_centavos;
}

/** R3 falla: el beneficiario no está en la lista o está inactivo. */
export function r3Falla(ctx: ContextoRegla): boolean {
  return ctx.beneficiario === null || ctx.beneficiario.estado !== "activo";
}

/** Solo R5 y R8 se pueden desactivar (§4.2): el resto se evalúa siempre aunque `activas` diga false. */
export function desactivada(ctx: ContextoRegla, id: IdRegla): boolean {
  return (id === "R5" || id === "R8") && ctx.reglas.activas[id] === false;
}

export function textoDesactivada(ctx: ContextoRegla): string {
  return `Regla desactivada en v${ctx.reglas.version}`;
}
