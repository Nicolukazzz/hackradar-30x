// Sondeo del buzón cada minuto dentro del proceso web (#14). Lo arranca src/instrumentation.ts solo si
// hay buzón configurado. Un correo nuevo entra por la ingesta única y aparece en la Bandeja.

import { cacheEnDisco } from "@/extraccion/cache";
import { proveedorDesdeEntorno } from "@/extraccion/llm/proveedor";
import { extractorReal } from "@/ingesta/pipeline";
import { urlPublica } from "@/lib/url-publica";
import { obtenerRepositorio } from "@/repositorio";
import { ahoraHumano } from "@/servicios/comun";

import { type ConfigBuzon, enviarRespuesta, revisarBuzon } from "./buzon";
import { recibirCorreo } from "./recibir";

export async function revisarUnaVez(config: ConfigBuzon): Promise<number> {
  const repo = await obtenerRepositorio();
  const extractor = extractorReal({ llm: proveedorDesdeEntorno(), cache: cacheEnDisco() });
  return revisarBuzon(config, async (eml) => {
    const r = await recibirCorreo(eml, { repo, ahora: await ahoraHumano(repo), extractor, urlPortal: urlPublica("/portal") });
    console.info(JSON.stringify({ canal: "correo", ref: r.entrada.ref_interna, decision: r.entrada.decision }));
    if (r.respuesta) await enviarRespuesta(config, r.respuesta).catch((e: unknown) => console.error(JSON.stringify({ canal: "correo", respuesta: "falló", error: String(e) })));
  });
}

export function iniciarSondeo(config: ConfigBuzon, cadaMs = 60_000): void {
  let ocupado = false;
  const vuelta = async () => {
    if (ocupado) return; // una vuelta lenta (LLM) no se encima con la siguiente
    ocupado = true;
    try {
      await revisarUnaVez(config);
    } catch (e) {
      console.error(JSON.stringify({ canal: "correo", error: e instanceof Error ? e.message : String(e) }));
    } finally {
      ocupado = false;
    }
  };
  void vuelta();
  setInterval(() => void vuelta(), cadaMs).unref();
}
