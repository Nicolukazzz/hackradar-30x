// R1 Extracción completa y confiable (§4.3). Si falla, escala.

import { evaluacion } from "./catalogo";
import { afectaciones, bajaConfianza, CAMPOS_OBLIGATORIOS, type ContextoRegla, pctEntero } from "./contexto";

export function r01Extraccion(ctx: ContextoRegla) {
  const { ext, reglas } = ctx;
  const minima = reglas.extraccion.confianza_minima;
  const datos = { confianza_minima_requerida: minima };

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
  const confianza = Math.min(ext.es_factura.confianza, ...CAMPOS_OBLIGATORIOS.map((c) => ext[c].confianza));
  return evaluacion("R1", "CUMPLE", `confianza mínima ${pctEntero(confianza)} ≥ ${pctEntero(minima)}`, {
    ...datos,
    confianza_minima_leida: confianza,
  });
}
