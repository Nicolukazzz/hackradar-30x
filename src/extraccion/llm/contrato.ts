// Contrato de los proveedores LLM: interfaz, error transitorio y validación zod de la respuesta.

import { z } from "zod";

import { MonedaSchema } from "@/dominio/esquemas";
import type { Campo, ProveedorLlm } from "@/dominio/tipos";

import { aDinero } from "../parsers/valores";
import type { DocumentoNormalizado, ExtraccionParcial, NombreCampo, ValoresCampos } from "../tipos";

export interface ProveedorLLM {
  nombre: ProveedorLlm;
  /** modelo concreto (entra en la clave de caché: cambiar de modelo no reutiliza respuestas viejas) */
  modelo?: string;
  /** Lee solo `faltantes`. Devuelve los campos con fuente "llm" y `proveedor_llm` = quién respondió. */
  extraer(doc: DocumentoNormalizado, faltantes: readonly NombreCampo[]): Promise<ExtraccionParcial>;
  /**
   * Doble lectura (#58): dos lectores independientes que `extraer()` (extraer.ts) consulta en paralelo y cruza con
   * el parser, 2 de 3. Si existe, `extraer` de este objeto no se usa para los campos.
   */
  lectores?: readonly [ProveedorLLM, ProveedorLLM];
}

/** 429, 5xx, timeout, red caída o llave inválida: se prueba con el siguiente proveedor. */
export class ErrorLLM extends Error {
  constructor(
    readonly proveedor: ProveedorLlm,
    mensaje: string,
    readonly estado: number | null = null,
  ) {
    super(`${proveedor}: ${mensaje}`);
    this.name = "ErrorLLM";
  }
}

/** Lo que un LLM dice de sí mismo no basta para superar a un parser con etiqueta (0,99). */
export const CONFIANZA_MAXIMA_LLM = 0.95;

const confianza = z.number().min(0).max(1);
const campoLlm = <T extends z.ZodType>(valor: T) => z.object({ valor: valor.nullable(), confianza }).optional();
const montoLlm = z.object({ monto: z.string().regex(/^\d+(\.\d{1,2})?$/), moneda: MonedaSchema });

/** Esquema de la respuesta del LLM. Cualquier desvío (tipo, formato, monto como número) invalida toda la respuesta. */
export const RespuestaLlmSchema = z.object({
  es_factura: campoLlm(z.boolean()),
  beneficiario_nombre: campoLlm(z.string().min(1).max(200)),
  numero: campoLlm(z.string().min(1).max(60)),
  monto_total: campoLlm(montoLlm),
  subtotal: campoLlm(montoLlm),
  impuestos: campoLlm(montoLlm),
  fecha_emision: campoLlm(z.iso.date()),
  fecha_vencimiento: campoLlm(z.iso.date()),
  cuenta_destino_ultimos4: campoLlm(z.string().regex(/^\d{4}$/)),
  concepto: campoLlm(z.string().min(1).max(300)),
  referencia_acuerdo: campoLlm(z.string().min(1).max(60)),
  hito_numero: campoLlm(z.int().positive()),
  idioma: z.enum(["es", "en", "pt"]).optional(),
  instrucciones_sospechosas: z.array(z.string().max(500)).max(20).optional(),
});

/**
 * Texto crudo del LLM → parcial validado. null si no es JSON o no cumple el esquema:
 * la respuesta entera se descarta y los campos siguen faltando (R1 escalará).
 */
export function validarRespuestaLlm(texto: string, proveedor: ProveedorLlm): ExtraccionParcial | null {
  let json: unknown;
  try {
    json = JSON.parse(texto.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
  } catch {
    return null;
  }
  const r = RespuestaLlmSchema.safeParse(json);
  if (!r.success) return null;

  const parcial: ExtraccionParcial = { proveedor_llm: proveedor };
  const poner = <K extends NombreCampo>(k: K, c: { valor: ValoresCampos[K] | null; confianza: number } | undefined) => {
    if (c && c.valor !== null) {
      (parcial as Record<string, Campo<unknown>>)[k] = {
        valor: c.valor,
        confianza: Math.min(c.confianza, CONFIANZA_MAXIMA_LLM),
        fuente: "llm",
      };
    }
  };
  const dinero = (c: { valor: z.infer<typeof montoLlm> | null; confianza: number } | undefined) =>
    c ? { valor: c.valor ? aDinero(c.valor.moneda, c.valor.monto) : null, confianza: c.confianza } : undefined;

  const d = r.data;
  poner("es_factura", d.es_factura);
  poner("beneficiario_nombre", d.beneficiario_nombre);
  poner("numero", d.numero);
  poner("monto_total", dinero(d.monto_total));
  poner("subtotal", dinero(d.subtotal));
  poner("impuestos", dinero(d.impuestos));
  poner("fecha_emision", d.fecha_emision);
  poner("fecha_vencimiento", d.fecha_vencimiento);
  poner("cuenta_destino_ultimos4", d.cuenta_destino_ultimos4);
  poner("concepto", d.concepto);
  poner("referencia_acuerdo", d.referencia_acuerdo);
  poner("hito_numero", d.hito_numero);
  if (d.idioma) parcial.idioma = d.idioma;
  parcial.instrucciones_sospechosas = (d.instrucciones_sospechosas ?? []).map((s) => s.trim()).filter(Boolean);
  return parcial;
}
