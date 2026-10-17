// Sondeo del buzón cada minuto dentro del proceso web (#14). Lo arranca src/instrumentation.ts solo si
// hay buzón configurado. Un correo nuevo entra por la ingesta única y aparece en la Bandeja.

import { obtenerRepositorio } from "@/repositorio";

import { dependenciasCanal } from "../dependencias";
import { type ConfigBuzon, enviarRespuesta, revisarBuzon } from "./buzon";
import { recibirCorreo } from "./recibir";
import { type ConfigSaliente, configSalienteDesdeEntorno } from "./saliente";

const registrar = (datos: Record<string, unknown>) => console.info(JSON.stringify({ canal: "correo", ...datos }));

export async function revisarUnaVez(config: ConfigBuzon, saliente: ConfigSaliente | null = configSalienteDesdeEntorno()): Promise<number> {
  const repo = await obtenerRepositorio();
  return revisarBuzon(config, async (eml) => {
    const r = await recibirCorreo(eml, { ...(await dependenciasCanal(repo)), exigirAutenticacion: true, buzonPropio: config.usuario });
    if (r.ignorado !== null) return registrar({ ignorado: r.ignorado });
    registrar({ ref: r.entrada.ref_interna, decision: r.entrada.decision });
    if (!r.respuesta) return;
    if (!saliente) return registrar({ respuesta: "sin BREVO_API_KEY: no se responde al proveedor" });
    await enviarRespuesta(saliente, r.respuesta).catch((e: unknown) => registrar({ respuesta: "falló", error: String(e) }));
  });
}

export function iniciarSondeo(config: ConfigBuzon, cadaMs = 60_000): void {
  const saliente = configSalienteDesdeEntorno();
  let ocupado = false;
  const vuelta = async () => {
    if (ocupado) return; // una vuelta lenta (LLM) no se encima con la siguiente
    ocupado = true;
    try {
      await revisarUnaVez(config, saliente);
    } catch (e) {
      registrar({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      ocupado = false;
    }
  };
  void vuelta();
  setInterval(() => void vuelta(), cadaMs).unref();
}
