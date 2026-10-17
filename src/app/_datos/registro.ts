// Registro para la pantalla `/registro` (mismo servicio que GET /api/registro, §12).

import { obtenerRepositorio } from "@/repositorio";
import { obtenerRegistro as servicio, type FiltroDecisionRegistro, type RespuestaRegistro } from "@/servicios/registro";

export type { DiaRegistro, FiltroDecisionRegistro, RespuestaRegistro } from "@/servicios/registro";

export async function obtenerRegistro(
  opciones: { decision?: FiltroDecisionRegistro; actor?: "agente" | "humano"; q?: string } = {},
): Promise<RespuestaRegistro> {
  return servicio(await obtenerRepositorio(), opciones);
}
