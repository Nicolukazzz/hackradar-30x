// Reglas para la pantalla `/reglas` (mismos servicios que GET /api/reglas y POST /api/reglas/simular, §12).

import { obtenerRepositorio } from "@/repositorio";
import { ErrorReglas, obtenerReglas as servicio, simularReglas, type RespuestaReglas } from "@/servicios/reglas";
import type { ReporteEvaluacion } from "@/evaluacion/evaluar";

export type { RespuestaReglas, UsoTasa } from "@/servicios/reglas";
export type { ReporteEvaluacion, ResultadoDocumento } from "@/evaluacion/evaluar";

/** Reglas vigentes + la simulación con esas mismas reglas (la caja "Prueba las reglas" arranca con datos). */
export async function obtenerReglasConSimulacion(): Promise<RespuestaReglas & { simulacion: ReporteEvaluacion | null }> {
  const repo = await obtenerRepositorio();
  const r = await servicio(repo);
  // Sin escenario cargado no hay set de prueba (409): la pantalla lo dice. Cualquier otro error sube a error.tsx.
  const simulacion = await simularReglas(repo, r.vigente).catch((e: unknown) => {
    if (e instanceof ErrorReglas && e.estado === 409) return null;
    throw e;
  });
  return { ...r, simulacion };
}
