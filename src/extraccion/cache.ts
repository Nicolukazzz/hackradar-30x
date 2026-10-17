// Caché de respuestas LLM por hash del contenido enviado (.cache/extraccion/<sha256>.json, ignorado por git).
// Solo guarda lo que aportó el LLM: el parser, texto_crudo y el detector de R10 se recalculan siempre,
// así dos correos con el mismo PDF pero distinto cuerpo nunca comparten texto_crudo.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { ExtraccionSchema } from "@/dominio/esquemas";

import type { DocumentoNormalizado, ExtraccionParcial, NombreCampo } from "./tipos";
import { PROMPT_SISTEMA } from "./llm/prompt";
import { textoCrudo } from "./normalizar";

export interface CacheExtraccion {
  leer(clave: string): Promise<ExtraccionParcial | null>;
  guardar(clave: string, parcial: ExtraccionParcial): Promise<void>;
}

const ParcialSchema = ExtraccionSchema.pick({
  es_factura: true,
  beneficiario_nombre: true,
  numero: true,
  monto_total: true,
  subtotal: true,
  impuestos: true,
  fecha_emision: true,
  fecha_vencimiento: true,
  cuenta_destino_ultimos4: true,
  concepto: true,
  referencia_acuerdo: true,
  hito_numero: true,
  idioma: true,
  proveedor_llm: true,
})
  .partial()
  .extend({ instrucciones_sospechosas: z.array(z.string()).optional() });

/**
 * Hash de exactamente lo que se le mandaría al LLM: proveedor y modelo, prompt de sistema, texto,
 * archivos y campos pedidos. Cambiar cualquiera de ellos invalida la caché sin tocar nada a mano.
 */
export function claveCache(doc: DocumentoNormalizado, faltantes: readonly NombreCampo[], proveedor: string): string {
  const h = createHash("sha256");
  h.update(JSON.stringify({ proveedor, prompt: PROMPT_SISTEMA, texto: textoCrudo(doc), faltantes }));
  for (const v of doc.visuales) h.update(createHash("sha256").update(v.bytes).digest("hex"));
  return h.digest("hex");
}

export function cacheEnDisco(dir = path.join(".cache", "extraccion")): CacheExtraccion {
  const ruta = (clave: string) => {
    if (!/^[0-9a-f]{64}$/.test(clave)) throw new Error(`clave de caché inválida: ${clave}`);
    return path.join(dir, `${clave}.json`);
  };
  return {
    async leer(clave) {
      try {
        const r = ParcialSchema.safeParse(JSON.parse(await readFile(ruta(clave), "utf8")));
        return r.success ? (r.data as ExtraccionParcial) : null;
      } catch {
        return null;
      }
    },
    async guardar(clave, parcial) {
      await mkdir(dir, { recursive: true });
      await writeFile(ruta(clave), JSON.stringify(parcial, null, 2));
    },
  };
}

export function cacheEnMemoria(): CacheExtraccion & { tamano(): number } {
  const m = new Map<string, ExtraccionParcial>();
  return {
    async leer(clave) {
      return m.get(clave) ?? null;
    },
    async guardar(clave, parcial) {
      m.set(clave, structuredClone(parcial));
    },
    tamano: () => m.size,
  };
}
