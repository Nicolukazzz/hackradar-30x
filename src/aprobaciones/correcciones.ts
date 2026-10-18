// Correcciones humanas de los datos extraídos (#129). Al decidir sobre una factura escalada, quien aprueba puede corregir
// lo que el agente leyó mal o con dudas (el total, la cuenta, una fecha). La corrección no reescribe nada: viaja con la
// DECISION_HUMANA (campo `extraccion`, cada dato corregido con fuente `humano` y confianza 1) y queda en el registro.
// Puro: sin reloj, red ni disco.

import { z } from "zod";

import { MONEDAS, type Campo, type Dinero, type EntradaRegistro, type Extraccion } from "@/dominio/tipos";

const Texto = z.string().trim().min(1).max(200);
const Fecha = z.iso.date();
const DineroSchema = z.strictObject({ centavos: z.number().int().positive().max(1e15), moneda: z.enum(MONEDAS) });

/**
 * Datos que una persona puede corregir al decidir. Todos opcionales; los que vienen deben ser válidos (monto
 * positivo, cuenta de 4 dígitos, fechas AAAA-MM-DD).
 */
export const CorreccionesSchema = z
  .strictObject({
    beneficiario_nombre: Texto,
    identificacion_fiscal: Texto,
    numero: Texto,
    concepto: Texto,
    referencia_acuerdo: Texto,
    fecha_emision: Fecha,
    fecha_vencimiento: Fecha,
    cuenta_destino_ultimos4: z.string().regex(/^\d{4}$/, "La cuenta son los últimos 4 dígitos."),
    monto_total: DineroSchema,
    subtotal: DineroSchema,
    impuestos: DineroSchema,
  })
  .partial();

/** Correcciones validadas que viajan con la decisión humana. */
export type Correcciones = z.infer<typeof CorreccionesSchema>;
/** Campo de la extracción que se puede corregir. */
export type CampoCorregible = keyof Correcciones;

/** Nombre legible de cada campo corregible, para la explicación de la decisión. */
export const ETIQUETA_CAMPO: Record<CampoCorregible, string> = {
  beneficiario_nombre: "proveedor",
  identificacion_fiscal: "identificación fiscal",
  numero: "número",
  concepto: "concepto",
  referencia_acuerdo: "referencia",
  fecha_emision: "fecha de emisión",
  fecha_vencimiento: "vencimiento",
  cuenta_destino_ultimos4: "cuenta",
  monto_total: "total",
  subtotal: "subtotal",
  impuestos: "impuestos",
};

const humano = <T>(valor: T): Campo<T> => ({ valor, confianza: 1, fuente: "humano" });

/** La extracción con las correcciones encima. Sin correcciones devuelve la misma referencia. */
export function aplicarCorrecciones(ext: Extraccion, c: Correcciones): Extraccion {
  const claves = Object.keys(c) as CampoCorregible[];
  if (claves.length === 0) return ext;
  const nueva: Extraccion = structuredClone(ext);
  for (const k of claves) {
    const v = c[k];
    if (v === undefined) continue;
    (nueva as Record<string, unknown>)[k] = humano(v);
  }
  return nueva;
}

/** Datos ya corregidos por una firma anterior (doble aprobación): la última DECISION_HUMANA con extracción. */
export function extraccionVigente(registro: readonly EntradaRegistro[], origen: EntradaRegistro): Extraccion | null {
  const corregida = registro.findLast((e) => e.tipo === "DECISION_HUMANA" && e.entrada_origen === origen.id && e.extraccion !== null);
  return corregida?.extraccion ?? origen.extraccion;
}

function texto(v: unknown, formatear: (d: Dinero) => string): string {
  if (v === null || v === undefined) return "sin dato";
  if (typeof v === "object" && "centavos" in (v as object)) return formatear(v as Dinero);
  return String(v);
}

/** "total USD 3.367,20 → USD 3.300,00; cuenta 2012 → 2013". Solo lo que de verdad cambió. */
export function resumenCorrecciones(antes: Extraccion | null, c: Correcciones, formatear: (d: Dinero) => string): string | null {
  const partes: string[] = [];
  for (const k of Object.keys(c) as CampoCorregible[]) {
    const nuevo = c[k];
    const previo = (antes?.[k] as Campo<unknown> | undefined)?.valor ?? null;
    if (JSON.stringify(previo) === JSON.stringify(nuevo)) continue;
    partes.push(`${ETIQUETA_CAMPO[k]} ${texto(previo, formatear)} → ${texto(nuevo, formatear)}`);
  }
  return partes.length > 0 ? partes.join("; ") : null;
}
