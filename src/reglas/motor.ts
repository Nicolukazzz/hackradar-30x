// Motor de reglas (especificación §4–§7, §10). Código puro y determinista:
// mismo input ⇒ mismo output. Sin I/O, sin reloj, sin LLM. Ante cualquier error, ESCALAR.

import type { DatosComunes } from "@/dominio/cargar";
import { aUsd, monedaBase } from "@/dominio/dinero";
import { instante } from "@/dominio/reloj";
import {
  type DocumentoRecibido,
  type EntradaRegistro,
  type EvaluacionRegla,
  type Extraccion,
  ID_REGLAS,
  type Reglas,
  type ResultadoMotor,
  type TablaTasas,
} from "@/dominio/tipos";
import { crearEntradaAgente, siguienteIdRegistro } from "@/registro/registro";

import { asignarAprobador, responderAntesDe } from "./asignacion";
import { evaluacion } from "./catalogo";
import { combinar } from "./combinar";
import { afectado, type ContextoRegla, montoUsd, type Regla } from "./contexto";
import { EXPLICACION_ERROR, EXPLICACION_SIN_REGLAS, explicar, observaciones } from "./explicar";
import { periodoDe } from "./libro";
import { aplicar, type EstadoPresupuesto, estadoInicial } from "./presupuesto";
import { identificar, modoIdentidad } from "./identidad";
import { r01Extraccion } from "./r01-extraccion";
import { sinConfigurar } from "./sin-configurar";
import { r02Duplicado } from "./r02-duplicado";
import { r03Beneficiario } from "./r03-beneficiario";
import { r04Cuenta } from "./r04-cuenta";
import { r05Acordado } from "./r05-acordado";
import { r06Maximo } from "./r06-maximo";
import { r07Presupuesto } from "./r07-presupuesto";
import { r08Mensual } from "./r08-mensual";
import { r09Automatico } from "./r09-automatico";
import { r10Instrucciones } from "./r10-instrucciones";
import { r11Remitente } from "./r11-remitente";

/** R1 → R11 en orden. Se corren todas siempre para que la traza quede completa. */
export const REGLAS: readonly Regla[] = [
  r01Extraccion, r02Duplicado, r03Beneficiario, r04Cuenta, r05Acordado, r06Maximo,
  r07Presupuesto, r08Mensual, r09Automatico, r10Instrucciones, r11Remitente,
];

export type DatosMotor = Pick<DatosComunes, "beneficiarios" | "aprobadores" | "tasas">;

export type EntradaMotor = {
  doc: DocumentoRecibido;
  ext: Extraccion;
  datos: DatosMotor;
  reglas: Reglas;
  historial: EntradaRegistro[];
  presupuesto: EstadoPresupuesto;
  ahora: string;
};

function tasasPara(datos: DatosMotor, reglas: Reglas, ahora: string): TablaTasas {
  const periodo = ahora.slice(0, 7);
  // Sin tabla del periodo solo se puede convertir la moneda base: cualquier otra falla R1 y escala.
  return datos.tasas[periodo] ?? { periodo, base: monedaBase(reglas), tasas: {} };
}

/**
 * Presupuesto al empezar el lote, con lo ya pagado en la moneda base de hoy (#86). Si una decisión anterior está en otra
 * moneda y no hay tasa para convertirla, disponible 0: R7 frena antes que sumar monedas distintas.
 */
function presupuestoInicial(historial: readonly EntradaRegistro[], ctx: ContextoLote, periodo: string): EstadoPresupuesto {
  try {
    return estadoInicial(historial, ctx.reglas, periodo, tasasPara(ctx.datos, ctx.reglas, ctx.ahora));
  } catch {
    const sinConvertir = estadoInicial(historial, ctx.reglas, periodo);
    return { ...sinConvertir, disponible: Math.min(0, sinConvertir.disponible) };
  }
}

function explicacionSinDecidir(reglas: Reglas, tasas: TablaTasas): string | null {
  if (sinConfigurar(reglas)) return EXPLICACION_SIN_REGLAS;
  if (tasas.base !== monedaBase(reglas)) {
    return `Escalada: los límites de las reglas están en ${monedaBase(reglas)} y las tasas del día en ${tasas.base}; hasta guardar las reglas en ${tasas.base}, ninguna factura se paga ni se frena sola. Una persona debe decidir.`;
  }
  return null;
}

function todas(resultado: EvaluacionRegla["resultado"], comparacion: string): EvaluacionRegla[] {
  return ID_REGLAS.map((id) => evaluacion(id, resultado, comparacion));
}

function resultadoError(input: EntradaMotor): ResultadoMotor {
  let asignado: string | null = null;
  let plazo: string | null = null;
  try {
    asignado = input.datos.aprobadores.find((a) => a.principal)?.id ?? null;
    plazo = responderAntesDe(null, input.ahora);
  } catch {
    // sin asignación: igual queda ESCALAR
  }
  return {
    decision: "ESCALAR",
    evaluaciones: todas("INDETERMINADO", "no evaluada: error interno"),
    reglas_que_fallaron: [...ID_REGLAS],
    monto_usd_centavos: null,
    tasa_usada: null,
    disponible_antes_usd_centavos: input.presupuesto?.disponible ?? 0,
    asignado_a: asignado,
    responder_antes_de: plazo,
    explicacion: EXPLICACION_ERROR,
    observaciones: [],
  };
}

/** Corre una regla aislada: si lanza, queda INDETERMINADO (y por lo tanto escala). */
function correr(regla: Regla, id: EvaluacionRegla["id"], ctx: ContextoRegla): EvaluacionRegla {
  try {
    const e = regla(ctx);
    if (e.id !== id) throw new Error(`la regla ${id} devolvió ${e.id}`);
    return e;
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    return evaluacion(id, "INDETERMINADO", `error al evaluar (${detalle})`);
  }
}

export function evaluarFactura(input: EntradaMotor): ResultadoMotor {
  try {
    return evaluarSinProteccion(input);
  } catch {
    return resultadoError(input);
  }
}

function evaluarSinProteccion(input: EntradaMotor): ResultadoMotor {
  const { doc, ext, datos, reglas, ahora, presupuesto } = input;
  const minima = reglas.extraccion.confianza_minima;
  const base = { disponible_antes_usd_centavos: presupuesto.disponible, asignado_a: null, responder_antes_de: null };

  // Paso 0 (§5): no es factura con confianza suficiente → no entra a las reglas de pago.
  if (ext.es_factura.valor === false && ext.es_factura.confianza >= minima) {
    const evaluaciones = todas("NO_APLICA", "no es factura: no entra a las reglas de pago");
    return {
      ...base,
      decision: "RECHAZADA_NO_FACTURA",
      evaluaciones,
      reglas_que_fallaron: [],
      monto_usd_centavos: null,
      tasa_usada: null,
      explicacion: explicar({ decision: "RECHAZADA_NO_FACTURA", evaluaciones, doc, ext, beneficiario: null, monto_usd_centavos: null, reglas, ahora }),
      observaciones: [],
    };
  }

  const tasas = tasasPara(datos, reglas, ahora);
  const identidad = identificar(ext, datos.beneficiarios, modoIdentidad(reglas), minima);
  const beneficiario = identidad.beneficiario;
  const ctx: ContextoRegla = {
    doc, ext, reglas, tasas, beneficiario, identidad, ahora, presupuesto,
    total_permitidos: datos.beneficiarios.filter((b) => b.estado === "activo").length,
    historial: input.historial,
  };

  const evaluaciones = REGLAS.map((regla, i) => correr(regla, ID_REGLAS[i]!, ctx));
  const usd = montoUsd(ctx);
  const tasa_usada = usd !== null && ext.monto_total.valor ? aUsd(ext.monto_total.valor, tasas).tasa_usada : null;
  const combinado = combinar(evaluaciones, usd);
  // #106: sin reglas guardadas por la empresa ninguna factura se decide sola; la traza igual muestra cada regla.
  // #86: límites en una moneda y tasas en otra (cambió la moneda base sin guardar reglas nuevas): tampoco.
  const monedaDistinta = tasas.base !== monedaBase(reglas);
  const sinDecidir = sinConfigurar(reglas) || monedaDistinta;
  const decision = sinDecidir ? "ESCALAR" : combinado.decision;
  const { reglas_que_fallaron } = combinado;

  let asignado_a: string | null = null;
  let responder_antes_de: string | null = null;
  if (decision === "ESCALAR") {
    asignado_a = asignarAprobador(evaluaciones, usd, datos.aprobadores);
    const vence = afectado(ctx, "fecha_vencimiento") ? null : ext.fecha_vencimiento.valor;
    responder_antes_de = responderAntesDe(vence, ahora);
  }

  return {
    decision,
    evaluaciones,
    reglas_que_fallaron,
    monto_usd_centavos: usd,
    tasa_usada,
    disponible_antes_usd_centavos: presupuesto.disponible,
    asignado_a,
    responder_antes_de,
    explicacion: explicacionSinDecidir(reglas, tasas) ?? explicar({ decision, evaluaciones, doc, ext, beneficiario, monto_usd_centavos: usd, reglas, ahora }),
    observaciones: sinDecidir ? [] : observaciones(usd, reglas),
  };
}

export type ContextoLote = {
  datos: DatosMotor;
  reglas: Reglas;
  /** registro previo al lote (no se modifica) */
  historial: readonly EntradaRegistro[];
  ahora: string;
  /** id de periodo de presupuesto; por defecto el de `ahora` */
  periodo?: string;
};

export type ResultadoLote = {
  resultados: ResultadoMotor[];
  /** una DECISION_AGENTE por documento, en el mismo orden que resultados */
  entradas: EntradaRegistro[];
  presupuestoFinal: EstadoPresupuesto;
};

/**
 * Procesa en orden de llegada (§6). Entre documentos actualiza historial y presupuesto,
 * así un duplicado ve el pago anterior del mismo lote y R7/R8 ven lo ya pagado y reservado.
 */
export function procesarLote(docs: readonly { doc: DocumentoRecibido; ext: Extraccion }[], ctx: ContextoLote): ResultadoLote {
  const ordenados = [...docs].sort((a, b) => instante(a.doc.recibido_en) - instante(b.doc.recibido_en));
  const periodo = ctx.periodo ?? periodoDe(ctx.ahora, ctx.reglas.presupuesto.periodo);
  const historial = [...ctx.historial];
  let presupuesto = presupuestoInicial(historial, ctx, periodo);
  const resultados: ResultadoMotor[] = [];
  const entradas: EntradaRegistro[] = [];

  for (const { doc, ext } of ordenados) {
    const resultado = evaluarFactura({ doc, ext, datos: ctx.datos, reglas: ctx.reglas, historial, presupuesto, ahora: ctx.ahora });
    const entrada = crearEntradaAgente({
      resultado, doc, ext, reglas: ctx.reglas,
      id: siguienteIdRegistro(historial, ctx.ahora.slice(0, 4)),
      // La hora de llegada hace legible la traza ("pagada 09:14:10"), pero el periodo de la entrada debe ser
      // el del lote: si llegó en otro periodo, se registra con `ahora` para que presupuesto y R8 la cuenten igual.
      momento: periodoDe(doc.recibido_en, ctx.reglas.presupuesto.periodo) === periodo ? doc.recibido_en : ctx.ahora,
    });
    resultados.push(resultado);
    entradas.push(entrada);
    historial.push(entrada);
    presupuesto = aplicar(presupuesto, resultado.decision, resultado.monto_usd_centavos);
  }
  return { resultados, entradas, presupuestoFinal: presupuesto };
}
