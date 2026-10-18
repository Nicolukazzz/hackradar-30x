// R1 Extracción completa y confiable (§4.3). Si falla, escala.

import { evaluacion } from "./catalogo";
import { afectaciones, bajaConfianza, type ContextoRegla, obligatoriosDe, pctEntero } from "./contexto";

export function r01Extraccion(ctx: ContextoRegla) {
  const { ext, reglas } = ctx;
  const minima = reglas.extraccion.confianza_minima;
  const datos = { confianza_minima_requerida: minima };

  // El parser no alcanzó y el LLM no respondió (#103): no hay nada confiable que leer. Siempre falla (escala).
  if (ext.senales_llm.sin_respuesta) {
    return evaluacion("R1", "FALLA", "el servicio de lectura no respondió; no se pudo leer el documento", {
      ...datos,
      lectura: "sin_respuesta",
      campos_afectados: "es_factura",
    });
  }

  if (ext.es_factura.valor !== true || bajaConfianza(ext.es_factura.confianza, minima)) {
    return evaluacion("R1", "FALLA", `no se pudo confirmar que sea factura (confianza ${pctEntero(ext.es_factura.confianza)} < ${pctEntero(minima)})`, {
      ...datos,
      campos_afectados: "es_factura",
    });
  }
  const lista = afectaciones(ctx);
  if (lista.length > 0) {
    return evaluacion("R1", "FALLA", lista.map((a) => a.motivo).join(" · "), {
      ...datos,
      campos_afectados: [...new Set(lista.map((a) => a.campo))].join(","),
    });
  }
  const confianza = Math.min(ext.es_factura.confianza, ...obligatoriosDe(reglas).map((c) => ext[c]?.confianza ?? 0));
  return evaluacion("R1", "CUMPLE", `confianza mínima ${pctEntero(confianza)} ≥ ${pctEntero(minima)}`, {
    ...datos,
    confianza_minima_leida: confianza,
  });
}
