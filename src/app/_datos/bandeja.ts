// Bandeja para la pantalla `/` (mismo servicio que GET /api/bandeja, §12).

import { obtenerRepositorio } from "@/repositorio";
import { obtenerBandeja as servicio, type FiltroDecision, type RespuestaBandeja } from "@/servicios/bandeja";

import { exigirMiembro } from "./sesion";

export type { FilaBandeja, FiltroDecision, RespuestaBandeja } from "@/servicios/bandeja";

export async function obtenerBandeja(opciones: { decision?: FiltroDecision; q?: string } = {}): Promise<RespuestaBandeja> {
  await exigirMiembro();
  return servicio(await obtenerRepositorio(), opciones);
}
