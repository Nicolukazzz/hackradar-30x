// Tipos internos del extractor (§8 paso 4). El contrato público es `Extraccion` (src/dominio/tipos.ts).

import type { Campo, Dinero, Formato, Idioma, ProveedorLlm } from "@/dominio/tipos";

/** Archivo que solo se puede leer "mirándolo": imagen o PDF escaneado. Va al LLM, nunca al parser. */
export type ArchivoVisual = { nombre: string; mime: string; bytes: Buffer };

/** Documento ya convertido a texto por líneas + lo que solo se puede leer con visión. */
export type DocumentoNormalizado = {
  formato: Formato;
  asunto: string | null;
  /** cuerpo del correo o mensaje del chat */
  texto_mensaje: string | null;
  /** texto de los adjuntos legibles (PDF con texto, XML), una línea por renglón visual; celdas separadas por " | " */
  lineas_adjuntos: string[];
  /** XML de factura electrónica, si vino (se parsea con xml-factura.ts, confianza 1,0) */
  xml: string | null;
  /** imágenes y PDF escaneados (texto < 50 caracteres) */
  visuales: ArchivoVisual[];
  /** nombre del adjunto principal (el primero), o null si el documento es solo texto */
  adjunto_principal: string | null;
  /** adjuntos que no se pudieron leer (corruptos, con clave, ruta inválida): sus campos quedan vacíos y R1 escala */
  errores: string[];
};

/** Campos que R1 exige (§4.3). Si alguno queda bajo la confianza mínima, se consulta al LLM. */
export const CAMPOS_OBLIGATORIOS = [
  "beneficiario_nombre",
  "numero",
  "monto_total",
  "fecha_emision",
  "fecha_vencimiento",
  "cuenta_destino_ultimos4",
  "concepto",
] as const;

export const CAMPOS_OPCIONALES = ["subtotal", "impuestos", "referencia_acuerdo", "hito_numero", "identificacion_fiscal"] as const;

export type ValoresCampos = {
  es_factura: boolean;
  beneficiario_nombre: string;
  numero: string;
  monto_total: Dinero;
  subtotal: Dinero;
  impuestos: Dinero;
  fecha_emision: string;
  fecha_vencimiento: string;
  cuenta_destino_ultimos4: string;
  concepto: string;
  referencia_acuerdo: string;
  hito_numero: number;
  identificacion_fiscal: string;
};

export type NombreCampo = keyof ValoresCampos;

export const NOMBRES_CAMPOS: readonly NombreCampo[] = ["es_factura", ...CAMPOS_OBLIGATORIOS, ...CAMPOS_OPCIONALES];

/** Lo que aporta un parser o un LLM: solo los campos que encontró. */
export type ExtraccionParcial = { [K in NombreCampo]?: Campo<ValoresCampos[K]> } & {
  idioma?: Idioma;
  /** solo LLM: frases del documento que intentan dar órdenes. El código decide qué hacer con ellas (R10). */
  instrucciones_sospechosas?: string[];
  /** quién produjo este parcial (solo LLM) */
  proveedor_llm?: ProveedorLlm;
  /** se consultó al LLM y ningún proveedor respondió (503, 429, red…) */
  sin_respuesta?: true;
  /** por qué no respondió (último error: "groq: HTTP 404"), para la traza */
  fallo?: string;
};

/** Confianzas del parser (issue #4): etiqueta + valor válido / valor inferido sin etiqueta. */
export const CONFIANZA_ETIQUETA = 0.99;
export const CONFIANZA_INFERIDA = 0.6;
