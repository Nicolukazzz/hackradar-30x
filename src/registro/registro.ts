// Registro append-only (especificación §9). Solo se crean entradas: no hay funciones para editar ni borrar.

import type { DocumentoRecibido, EntradaRegistro, Extraccion, Reglas, ResultadoMotor } from "@/dominio/tipos";

const ID = /^REG-(\d{4})-(\d{6})$/;

/** Siguiente id consecutivo del año: "REG-2026-000013". Ignora ids importados (REG-HIST-…). */
export function siguienteIdRegistro(historial: readonly EntradaRegistro[], anio: string): string {
  let max = 0;
  for (const e of historial) {
    const m = ID.exec(e.id);
    if (m?.[1] === anio) max = Math.max(max, Number(m[2]));
  }
  return `REG-${anio}-${String(max + 1).padStart(6, "0")}`;
}

/** Chip de la UI: "R9 · 4.500,00 > 3.000,00". */
export function chip(id: string, comparacion: string): string {
  return `${id} · ${comparacion.replace(/ USD( disponibles al evaluar)?$/, "")}`;
}

function comparaciones(resultado: ResultadoMotor): string[] {
  if (resultado.decision === "RECHAZADA_NO_FACTURA") return [];
  if (resultado.decision === "PAGAR") {
    return resultado.evaluaciones.filter((e) => e.id === "R9").map((e) => chip(e.id, e.comparacion));
  }
  return resultado.evaluaciones
    .filter((e) => e.resultado === "FALLA" || e.resultado === "INDETERMINADO")
    .map((e) => chip(e.id, e.comparacion));
}

export type NuevaEntradaAgente = {
  resultado: ResultadoMotor;
  doc: DocumentoRecibido;
  ext: Extraccion;
  reglas: Reglas;
  id: string;
  momento: string;
};

export function crearEntradaAgente({ resultado, doc, ext, reglas, id, momento }: NuevaEntradaAgente): EntradaRegistro {
  return {
    id,
    momento,
    actor: { tipo: "agente" },
    tipo: "DECISION_AGENTE",
    ref_interna: doc.ref_interna,
    factura_numero: ext.numero.valor,
    beneficiario: ext.beneficiario_nombre.valor,
    canal: doc.canal,
    formato: doc.formato,
    monto_original: ext.monto_total.valor,
    monto_usd_centavos: resultado.monto_usd_centavos,
    tasa_usada: resultado.tasa_usada,
    decision: resultado.decision,
    reglas_version: reglas.version,
    evaluaciones: resultado.evaluaciones,
    reglas_que_fallaron: resultado.reglas_que_fallaron,
    comparaciones: comparaciones(resultado),
    explicacion: resultado.explicacion,
    comentario: null,
    entrada_origen: null,
    extraccion: ext,
    sha256: doc.sha256 || null,
  };
}
