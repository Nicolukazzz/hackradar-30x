// POST /api/evaluar (§12): decisión simulada de una extracción, sin registrar nada.

import type { DocumentoRecibido, Extraccion, ResultadoMotor } from "@/dominio/tipos";
import { estadoInicial } from "@/reglas/presupuesto";
import { periodoDe } from "@/reglas/libro";
import { evaluarFactura } from "@/reglas/motor";
import type { Repositorio } from "@/repositorio/repositorio";

import { ahoraHumano } from "./comun";

/**
 * Decide una extracción con las reglas y el presupuesto de hoy, sin escribir en el registro (API para otros agentes).
 */
export async function evaluarSinRegistrar(repo: Repositorio, ext: Extraccion, beneficiario_id?: string): Promise<ResultadoMotor> {
  const [datos, reglas, historial, ahora] = await Promise.all([repo.datosComunes(), repo.reglasVigentes(), repo.registro(), ahoraHumano(repo)]);
  // Llega por API, no por un canal: remitente "interno" (R11 lo acepta solo si el beneficiario está en la lista).
  const doc: DocumentoRecibido = {
    canal: "carga_manual",
    remitente: { tipo: "interno", valor: "api" },
    recibido_en: ahora,
    adjuntos: [],
    ref_interna: "SIMULACION",
    sha256: "",
    formato: "pdf",
    beneficiario_remitente_id: beneficiario_id ?? null,
  };
  // #86: lo pagado en otra moneda base se convierte con las tasas del periodo; sin tasa, el motor escala.
  let presupuesto;
  try {
    presupuesto = estadoInicial(historial, reglas, periodoDe(ahora, reglas.presupuesto.periodo), datos.tasas[ahora.slice(0, 7)]);
  } catch {
    presupuesto = { ...estadoInicial(historial, reglas, periodoDe(ahora, reglas.presupuesto.periodo)), disponible: 0 };
  }
  return evaluarFactura({ doc, ext, datos, reglas, historial, presupuesto, ahora });
}
