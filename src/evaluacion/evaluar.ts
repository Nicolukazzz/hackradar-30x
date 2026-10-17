// Evaluación del agente contra el esperado de un escenario (especificación §14), modo golden.
// Núcleo mínimo para "Simular" en la pantalla Reglas (#17). El CLI y el informe en
// docs/research/ los agrega #7 sobre esta misma función.

import type { DecisionAgente, EntradaRegistro, IdRegla, Reglas } from "@/dominio/tipos";
import { procesarLote, type DatosMotor } from "@/reglas/motor";

import type { DocGolden } from "./escenario";

export type ResultadoDocumento = {
  ref_interna: string;
  factura_numero: string | null;
  beneficiario: string | null;
  esperado: DecisionAgente;
  obtenido: DecisionAgente;
  coincide: boolean;
  reglas_esperadas: IdRegla[];
  reglas_obtenidas: IdRegla[];
};

export type ReporteEvaluacion = {
  reglas_version: number;
  total: number;
  coinciden: number;
  /** esperado ≠ PAGAR y obtenido = PAGAR. ≥ 1 es falla crítica: descalifica. */
  pagos_indebidos: number;
  /** decisiones correctas que no son ESCALAR */
  autonomas: number;
  /** autonomas / total, 0..1 */
  autonomia: number;
  /** esperado PAGAR o FRENAR, obtenido ESCALAR */
  escalados_innecesarios: number;
  reglas_correctas: number;
  documentos: ResultadoDocumento[];
};

export type ContextoEvaluacion = {
  datos: DatosMotor;
  reglas: Reglas;
  historial: readonly EntradaRegistro[];
  ahora: string;
};

/** Corre el lote con `reglas` y compara cada decisión con el esperado del escenario. No registra nada. */
export function evaluarLote(docs: readonly DocGolden[], ctx: ContextoEvaluacion): ReporteEvaluacion {
  const { resultados, entradas } = procesarLote(docs, ctx);
  const porRef = new Map(docs.map((d) => [d.doc.ref_interna, d]));
  const documentos = entradas.map((e, i): ResultadoDocumento => {
    const golden = porRef.get(e.ref_interna);
    const obtenido = resultados[i]?.decision ?? "ESCALAR";
    const esperado = golden?.esperado.decision ?? "ESCALAR";
    return {
      ref_interna: e.ref_interna,
      factura_numero: e.factura_numero,
      beneficiario: e.beneficiario,
      esperado,
      obtenido,
      coincide: obtenido === esperado,
      reglas_esperadas: golden?.esperado.reglas_que_fallan ?? [],
      reglas_obtenidas: resultados[i]?.reglas_que_fallaron ?? [],
    };
  });
  const total = documentos.length;
  const autonomas = documentos.filter((d) => d.coincide && d.obtenido !== "ESCALAR").length;
  return {
    reglas_version: ctx.reglas.version,
    total,
    coinciden: documentos.filter((d) => d.coincide).length,
    pagos_indebidos: documentos.filter((d) => d.obtenido === "PAGAR" && d.esperado !== "PAGAR").length,
    autonomas,
    autonomia: total === 0 ? 0 : autonomas / total,
    escalados_innecesarios: documentos.filter((d) => d.obtenido === "ESCALAR" && (d.esperado === "PAGAR" || d.esperado === "FRENAR")).length,
    reglas_correctas: documentos.filter((d) => d.reglas_obtenidas.join() === d.reglas_esperadas.join()).length,
    documentos,
  };
}
