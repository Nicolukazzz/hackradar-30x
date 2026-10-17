// Carga un escenario del dataset por la ingesta (#11) y muestra la decisión y la respuesta al remitente.
//   npm run cargar-escenario -- --escenario lote-demo-oct [--extraccion golden|real]
// golden (por defecto): extracción esperada, sin LLM. real: parser + LLM_PROVIDER con caché en .cache/extraccion/.

import { parseArgs } from "node:util";

import { cargarEscenario } from "@/dominio/cargar";
import { cacheEnDisco } from "@/extraccion/cache";
import { proveedorDesdeEntorno } from "@/extraccion/llm/proveedor";
import { cargarEscenarioPorIngesta, extractorGolden } from "@/ingesta/cargar-escenario";
import { extractorReal } from "@/ingesta/pipeline";
import { textoRespuesta } from "@/ingesta/respuesta";
import { crearRepositorioMemoria } from "@/repositorio/memoria";

async function main() {
  const { values } = parseArgs({
    options: { escenario: { type: "string", default: "lote-demo-oct" }, extraccion: { type: "string", default: "golden" } },
  });
  const id = values.escenario ?? "lote-demo-oct";
  if (values.extraccion !== "golden" && values.extraccion !== "real") throw new Error("--extraccion debe ser golden o real");

  const esc = await cargarEscenario(id);
  const repo = await crearRepositorioMemoria(id, undefined, { lote: "vacio" });
  const extractor =
    values.extraccion === "real"
      ? extractorReal({ llm: proveedorDesdeEntorno(), cache: cacheEnDisco(), dirBase: esc.carpeta })
      : await extractorGolden(id);

  const entradas = await cargarEscenarioPorIngesta(id, { repo, extractor });
  for (const e of entradas) {
    const esperado = esc.esperado.find((x) => x.ref_esperada === e.ref_interna);
    const marca = esperado?.decision === e.decision ? "✓" : "✗";
    console.log(`${marca} ${e.ref_interna} ${(e.factura_numero ?? "—").padEnd(11)} ${String(e.decision).padEnd(8)} ${e.reglas_que_fallaron.join(",") || "—"}`);
    console.log(`    → ${textoRespuesta(e, e.extraccion?.idioma ?? "es", { urlPortal: "https://…/portal" })}`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
