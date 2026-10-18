// Bandeja para la pantalla `/` (mismo servicio que GET /api/bandeja, §12).

import { obtenerRepositorio } from "@/repositorio";
import { obtenerBandeja as servicio, type OpcionesBandeja, type RespuestaBandeja } from "@/servicios/bandeja";
import { novedades, porVerificar, type PorVerificar } from "@/servicios/verificar";

import { exigirMiembro } from "./sesion";

export type { FilaBandeja, FiltroDecision, RespuestaBandeja } from "@/servicios/bandeja";

export async function obtenerBandeja(opciones: OpcionesBandeja = {}): Promise<RespuestaBandeja> {
  await exigirMiembro();
  return servicio(await obtenerRepositorio(), opciones);
}

/** Recuadro «Por verificar» y estado inicial de la Bandeja en vivo (mismos servicios que la API). */
export async function obtenerVerificacion(): Promise<{ filas: PorVerificar[]; novedades: { total: number; ultima: string | null } }> {
  await exigirMiembro();
  const repo = await obtenerRepositorio();
  const [filas, n] = await Promise.all([porVerificar(repo), novedades(repo)]);
  return { filas, novedades: n };
}
