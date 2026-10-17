// CLI: extrae cada documento de un escenario con el LLM configurado (LLM_PROVIDER + llaves en .env)
// y compara con extraccion_esperada. Sirve para probar Gemini/Groq sobre las imágenes (ES-4410, RV-1188).
//   npm run extraer -- --escenario lote-demo-oct [--solo es-4410]

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { cargarEscenario } from "@/dominio/cargar";
import type { DocumentoRecibido, Formato } from "@/dominio/tipos";
import { cacheEnDisco } from "@/extraccion/cache";
import { extraer } from "@/extraccion/extraer";
import { proveedorDesdeEntorno } from "@/extraccion/llm/proveedor";

const FORMATOS: Record<string, Formato> = { ".pdf": "pdf", ".eml": "correo", ".txt": "chat", ".png": "imagen", ".xml": "xml" };

async function main() {
  const { values } = parseArgs({ options: { escenario: { type: "string", default: "lote-demo-oct" }, solo: { type: "string" } } });
  const esc = await cargarEscenario(values.escenario ?? "lote-demo-oct");
  const llm = proveedorDesdeEntorno(process.env, (e) => console.warn(`  ⚠ ${e instanceof Error ? e.message : String(e)}`));
  console.log(`Escenario ${esc.config.id} · LLM: ${llm.nombre}`);

  for (const [i, meta] of esc.documentos.entries()) {
    if (values.solo && !meta.archivo_original.includes(values.solo)) continue;
    const { archivo_original, ...entrante } = meta;
    const principal = meta.adjuntos[0]?.ruta;
    const bytes = principal ? await readFile(path.join(esc.carpeta, principal)) : Buffer.from(meta.texto_mensaje ?? "", "utf8");
    const doc: DocumentoRecibido = {
      ...entrante,
      ref_interna: `INT-2026-${(i + 1).toString().padStart(6, "0")}`,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      formato: FORMATOS[path.extname(archivo_original)] ?? "pdf",
      beneficiario_remitente_id: null,
    };
    const ext = await extraer(doc, { llm, cache: cacheEnDisco(), dirBase: esc.carpeta });
    const esperado = esc.esperado.find((e) => e.documento === archivo_original)?.extraccion_esperada;
    console.log(`\n${archivo_original} · proveedor ${ext.proveedor_llm} · idioma ${ext.idioma}`);
    for (const k of ["es_factura", "beneficiario_nombre", "numero", "monto_total", "fecha_emision", "fecha_vencimiento", "cuenta_destino_ultimos4", "concepto"] as const) {
      const c = ext[k];
      const ok = JSON.stringify(c.valor) === JSON.stringify(esperado?.[k] ?? null) ? "✓" : "✗";
      console.log(`  ${ok} ${k.padEnd(24)} ${c.confianza.toFixed(2)} ${c.fuente.padEnd(6)} ${JSON.stringify(c.valor)}`);
    }
    if (ext.senales_llm.instrucciones_sospechosas.length) console.log(`  señales LLM: ${ext.senales_llm.instrucciones_sospechosas.join(" | ")}`);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
