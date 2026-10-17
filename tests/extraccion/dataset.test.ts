// Sin LLM (LLM_PROVIDER=ninguno), cada PDF/correo/chat del dataset extrae igual a extraccion_esperada.
// Las imágenes solo se leen con LLM: se marcan skip.

import { describe, expect, it } from "vitest";

import { cargarEscenario } from "@/dominio/cargar";
import { extraer } from "@/extraccion/extraer";
import { ninguno } from "@/extraccion/llm/ninguno";
import { CAMPOS_OBLIGATORIOS } from "@/extraccion/tipos";

import { aPlana, recibido } from "./ayuda";

const ESCENARIOS = ["lote-demo-oct", "trampas-extra"];

describe.each(ESCENARIOS)("extracción sin LLM · %s", async (id) => {
  const esc = await cargarEscenario(id);
  const casos = esc.documentos.map((meta, i) => ({
    meta,
    n: i + 1,
    esperado: esc.esperado.find((e) => e.documento === meta.archivo_original),
    esImagen: meta.adjuntos.some((a) => a.mime.startsWith("image/")),
  }));

  it.each(casos.filter((c) => !c.esImagen).map((c) => [c.meta.archivo_original, c] as const))("%s", async (_, c) => {
    const doc = await recibido(c.meta, esc.carpeta, c.n);
    const ext = await extraer(doc, { llm: ninguno, dirBase: esc.carpeta });
    expect(aPlana(ext)).toEqual(c.esperado?.extraccion_esperada);
    expect(ext.proveedor_llm).toBe("ninguno");
    // Lo que se leyó, se leyó con confianza suficiente: sin LLM no hay escalados por "no estoy seguro".
    if (ext.es_factura.valor) {
      for (const k of CAMPOS_OBLIGATORIOS) expect(ext[k].confianza, k).toBeGreaterThanOrEqual(0.9);
    } else {
      expect(ext.es_factura.confianza).toBeGreaterThanOrEqual(0.9);
    }
  });

  it.skip.each(casos.filter((c) => c.esImagen).map((c) => [c.meta.archivo_original] as const))("%s (imagen: requiere LLM)", () => {});
});
