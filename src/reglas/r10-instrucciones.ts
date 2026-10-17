// R10 Sin instrucciones dirigidas al agente (§4.3). Si falla, escala.
// El motor vuelve a escanear el texto aunque el extractor no reporte nada.

import { evaluacion } from "./catalogo";
import type { ContextoRegla } from "./contexto";
import { detectarInstrucciones, type Hallazgo } from "./inyeccion";

const DONDE_MENSAJE = { correo: "en el cuerpo del correo", telegram: "en el mensaje", portal: "en el mensaje", carga_manual: "en el mensaje" } as const;

export function r10Instrucciones(ctx: ContextoRegla) {
  const { doc, ext } = ctx;
  const mensaje = [doc.asunto, doc.texto_mensaje].filter(Boolean).join("\n");
  const enMensaje = detectarInstrucciones(mensaje);
  // texto_crudo suele incluir el cuerpo del correo: solo cuenta "en el documento" lo que no vino ya en el mensaje.
  const lineasMensaje = new Set(enMensaje.map((h) => h.linea));
  const enDocumento = detectarInstrucciones(ext.texto_crudo).filter((h) => !lineasMensaje.has(h.linea));
  const llm = ext.senales_llm.instrucciones_sospechosas.filter((s) => s.trim() !== "");

  const hallazgos: Hallazgo[] = [...enMensaje, ...enDocumento];
  if (hallazgos.length === 0 && llm.length === 0) return evaluacion("R10", "CUMPLE", "sin instrucciones dirigidas al agente");

  const lugares = [enMensaje.length > 0 ? DONDE_MENSAJE[doc.canal] : null, enDocumento.length > 0 ? "en el documento" : null].filter(Boolean);
  const donde = lugares.join(" y ").replace(" y en ", " y ");
  const fragmentos = [...new Set(hallazgos.map((h) => h.fragmento.toLowerCase()))].slice(0, 3);
  const partes: string[] = [];
  const citados = fragmentos.map((f) => "«" + f + "»").join(", ");
  if (fragmentos.length > 0) partes.push(`detectado: ${citados} ${donde}`);
  const cuantas = llm.length === 1 ? "una instrucción" : String(llm.length) + " instrucciones";
  if (llm.length > 0) partes.push(`el extractor reportó ${cuantas}`);
  const linea = hallazgos[0]?.linea ?? llm[0] ?? "";
  return evaluacion("R10", "FALLA", partes.join(" · "), {
    fragmento: linea.length > 160 ? `${linea.slice(0, 159)}…` : linea,
    donde,
    patrones: hallazgos.length,
    en_mensaje: enMensaje.length,
    en_documento: enDocumento.length,
    senales_llm: llm.length,
  });
}
