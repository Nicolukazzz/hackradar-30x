// Registro para la pantalla `/registro` (mismo servicio que GET /api/registro, §12).

import { type CampoRequerible, REQUERIDOS_POR_DEFECTO } from "@/dominio/tipos";
import { obtenerRepositorio } from "@/repositorio";
import { obtenerRegistro as servicio, type FiltroDecisionRegistro, type RespuestaRegistro } from "@/servicios/registro";

import { exigirMiembro } from "./sesion";

export { ConsultaRegistro } from "@/servicios/registro";
export type { DiaRegistro, FiltroDecisionRegistro, RespuestaRegistro } from "@/servicios/registro";

/** Registro filtrado y agrupado por día. Exige ser miembro. */
export async function obtenerRegistro(
  opciones: { decision?: FiltroDecisionRegistro; actor?: "agente" | "humano"; q?: string } = {},
): Promise<RespuestaRegistro> {
  await exigirMiembro();
  return servicio(await obtenerRepositorio(), opciones);
}

/** Con qué se juzga una extracción (para la vista de factura del registro, #119): campos exigidos y confianza mínima. */
export type CriteriosExtraccion = { requeridos: CampoRequerible[]; confianza_minima: number };

/** Campos exigidos y confianza mínima de las reglas vigentes. */
export async function obtenerCriteriosExtraccion(): Promise<CriteriosExtraccion> {
  await exigirMiembro();
  const r = await (await obtenerRepositorio()).reglasVigentes();
  return { requeridos: [...(r.requisitos?.obligatorios ?? REQUERIDOS_POR_DEFECTO)], confianza_minima: r.extraccion.confianza_minima };
}
