// Bandeja para la pantalla `/` (mismo servicio que GET /api/bandeja, §12).

import { demoActiva } from "@/app/api/_identidad";
import { puede } from "@/lib/auth/permisos";
import { obtenerRepositorio } from "@/repositorio";
import { obtenerBandeja as servicio, type FiltroDecision, type RespuestaBandeja } from "@/servicios/bandeja";

import { exigirMiembro } from "./sesion";

export type { FilaBandeja, FiltroDecision, RespuestaBandeja } from "@/servicios/bandeja";

export async function obtenerBandeja(opciones: { decision?: FiltroDecision; q?: string } = {}): Promise<RespuestaBandeja> {
  await exigirMiembro();
  return servicio(await obtenerRepositorio(), opciones);
}

/** "Reiniciar demo" (#76) se muestra solo a un admin y con modo demo (la ruta lo vuelve a exigir). */
export async function puedeReiniciarDemo(): Promise<boolean> {
  const sesion = await exigirMiembro();
  return demoActiva() && puede(sesion, "administrar");
}
