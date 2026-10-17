// Explicaciones en lenguaje natural (especificación §7). Salen de las evaluaciones, nunca del LLM.
// Orden: primero lo que frena, después lo que escala; dentro de cada grupo, R1 → R11. Se unen con "Además,".

import { formatear, formatearUsd, porcentaje } from "@/dominio/dinero";
import type { Beneficiario, DecisionAgente, DocumentoRecibido, EvaluacionRegla, Extraccion, Reglas } from "@/dominio/tipos";

import { fechaDe, fechaLegible, horaDe } from "./fechas";
import { tolerancia } from "./r05-acordado";

export type EntradaExplicacion = {
  decision: DecisionAgente;
  evaluaciones: readonly EvaluacionRegla[];
  doc: DocumentoRecibido;
  ext: Extraccion;
  beneficiario: Beneficiario | null;
  monto_usd_centavos: number | null;
  reglas: Reglas;
  ahora: string;
};

const usd = (centavos: number) => `USD ${centavos < 0 ? "-" : ""}${formatearUsd(Math.abs(centavos))}`;
const texto = (v: unknown) => (typeof v === "string" ? v : String(v ?? ""));
const numero = (v: unknown) => (typeof v === "number" ? v : 0);

/** Nombres que terminan en punto ("CloudNorte S.A.S.") no deben dejar ".." al cerrar la frase. */
function sinPuntoDoble(frase: string): string {
  return frase.replace(/\.\.(?=\s|$)/g, ".");
}

const CANAL: Record<DocumentoRecibido["canal"], string> = {
  correo: "correo",
  telegram: "mensaje de Telegram",
  portal: "documento del portal",
  carga_manual: "documento",
};

/** "a las 09:14:10" el mismo día; "el 08/10/2026 a las 09:30:00" otro día. */
function cuando(momento: string, ahora: string): string {
  const dia = fechaDe(momento) === fechaDe(ahora) ? "" : `el ${fechaLegible(fechaDe(momento))} `;
  return `${dia}a las ${horaDe(momento)}`;
}

/** `nombrado`: si una frase anterior ya nombró al beneficiario, esta no lo repite. */
function fraseRegla(e: EvaluacionRegla, x: EntradaExplicacion, nombre: string, nombrado: boolean): string {
  const d = e.datos;
  const de = nombrado ? "" : ` de ${nombre}`;
  const monto = x.monto_usd_centavos === null ? "el monto" : usd(x.monto_usd_centavos);

  if (e.resultado === "INDETERMINADO") {
    if (e.id === "R5") return `no se pudo asociar la factura a lo acordado con ${nombre} (${texto(d.motivo)}).`;
    return `no se pudo evaluar «${e.nombre}» (${e.comparacion}).`;
  }
  switch (e.id) {
    case "R1":
      return `el agente no está seguro de lo que leyó en la factura${de} (${e.comparacion}). Una persona debe confirmar los datos.`;
    case "R2": {
      const previa = texto(d.factura_previa);
      const momento = cuando(texto(d.momento_previo), x.ahora);
      const pagada = d.estado_previo === "pagada";
      if (d.criterio === "hito") return `${nombre} ya cobró el hito ${texto(d.hito)} con la factura ${previa}. Un hito se paga una sola vez.`;
      if (d.criterio === "archivo")
        return `${nombre} ya envió este mismo archivo (${previa}, ${pagada ? "pagada" : "escalada"} ${momento}). No se paga dos veces.`;
      if (d.criterio === "parecida")
        return `${nombre} ya cobró la factura ${previa} por casi el mismo monto y fecha (${pagada ? "pagada" : "escalada"} ${momento}). Puede ser un cobro repetido.`;
      return pagada
        ? `${nombre} ya cobró la factura ${previa} y se pagó ${momento}. No se paga dos veces.`
        : `${nombre} ya envió la factura ${previa} y quedó escalada ${momento}, pendiente de aprobación. No se paga dos veces.`;
    }
    case "R3":
      return `${nombre} no está en la lista de beneficiarios permitidos.`;
    case "R4":
      return `la cuenta de la factura (•••• ${texto(d.cuenta_factura)}) no es la registrada para ${nombre} (•••• ${texto(d.cuenta_registrada)}).`;
    case "R5":
      return `${nombre} cobra ${texto(d.cobrado)}, pero ${texto(d.referencia)} acordó ${texto(d.acordado)} (${porcentaje(numero(d.diferencia_pct))}; la tolerancia es ${tolerancia(numero(d.tolerancia_pct))}).`;
    case "R6":
      return `${nombrado ? monto : `la factura${de} (${monto})`} supera el máximo absoluto por pago de ${usd(numero(d.maximo_usd))}.`;
    case "R7":
      return `el pago (${monto}) supera el presupuesto disponible de ${usd(numero(d.disponible_usd))}, que ya descuenta lo reservado por escalados.`;
    case "R8": {
      const periodo = x.reglas.presupuesto.periodo === "mensual" ? "el mes" : "el periodo";
      return `con este pago ${nombre} llegaría a ${usd(numero(d.total_usd))} en ${periodo}, sobre su límite de ${usd(numero(d.limite_usd))}.`;
    }
    case "R9":
      return `${nombrado ? monto : `la factura${de} (${monto})`} supera el límite de pago automático de ${usd(numero(d.limite_usd))}.`;
    case "R10":
      return `el ${CANAL[x.doc.canal]}${de} traía instrucciones para el agente («${texto(d.fragmento)}»); se ignoraron y la factura quedó marcada.`;
    case "R11":
      return x.beneficiario
        ? `el remitente (${x.doc.remitente.valor}) no está vinculado a ${nombre}.`
        : `el remitente (${x.doc.remitente.valor}) no está vinculado a ningún beneficiario de la lista.`;
  }
}

function explicarPago(x: EntradaExplicacion, nombre: string): string {
  const r5 = x.evaluaciones.find((e) => e.id === "R5");
  const r4 = x.evaluaciones.find((e) => e.id === "R4");
  let acuerdo = "la regla de lo acordado está desactivada";
  if (r5?.resultado === "CUMPLE") {
    const d = r5.datos;
    acuerdo =
      d.hito && d.hitos_total
        ? `es el hito ${texto(d.hito)} de ${texto(d.hitos_total)} de ${texto(d.referencia)}, como se acordó (${texto(d.acordado)})`
        : `coincide con lo acordado en ${texto(d.referencia)} (${texto(d.acordado)})`;
  }
  const cuenta = `La cuenta •••• ${texto(r4?.datos.cuenta_factura)} es la registrada para ${nombre}`;
  const original = x.ext.monto_total.valor;
  const monto = x.monto_usd_centavos ?? 0;
  const montoTexto = original && original.moneda !== "USD" ? `${formatear(original)} = ${usd(monto)}` : usd(monto);
  return sinPuntoDoble(`Pagada: ${acuerdo}. ${cuenta}. Bajo el límite automático (${montoTexto} ≤ ${usd(x.reglas.limites.pago_automatico_usd)}).`);
}

export function explicar(x: EntradaExplicacion): string {
  const nombre = x.beneficiario?.nombre ?? x.ext.beneficiario_nombre.valor ?? "El beneficiario";
  if (x.decision === "PAGAR") return explicarPago(x, nombre);
  if (x.decision === "RECHAZADA_NO_FACTURA") {
    return `Rechazada: el documento no es una factura (confianza ${Math.floor(x.ext.es_factura.confianza * 100)}%); no entra a las reglas de pago.`;
  }

  const fallas = x.evaluaciones.filter((e) => e.resultado === "FALLA" || e.resultado === "INDETERMINADO");
  const frenan = fallas.filter((e) => e.si_falla === "FRENAR" && e.resultado === "FALLA");
  const resto = fallas.filter((e) => !frenan.includes(e));
  const frases: string[] = [];
  for (const e of [...frenan, ...resto]) frases.push(fraseRegla(e, x, nombre, frases.some((f) => f.includes(nombre))));
  const prefijo = x.decision === "FRENAR" ? "Frenada" : "Escalada";
  if (frases.length === 0) return `${prefijo}: no se cumplieron las condiciones mínimas para pagar automáticamente.`;
  let cierre = "";
  if (x.decision === "ESCALAR" && x.monto_usd_centavos !== null) {
    cierre = x.reglas.presupuesto.contar_escalado_como_reservado
      ? ` Se reservan ${usd(x.monto_usd_centavos)} del presupuesto mientras una persona decide.`
      : ` Monto por decidir: ${usd(x.monto_usd_centavos)}.`;
  }
  return sinPuntoDoble(`${prefijo}: ${frases.join(" Además, ")}${cierre}`);
}

/** Observaciones que no deciden (§7): monto a ≤ 1 % por debajo del límite automático. */
export function observaciones(monto_usd_centavos: number | null, reglas: Reglas): string[] {
  const limite = reglas.limites.pago_automatico_usd;
  if (monto_usd_centavos === null || monto_usd_centavos > limite) return [];
  const dif = limite - monto_usd_centavos;
  if (dif * 100 > limite) return [];
  return [dif === 0 ? "El monto es exactamente el límite automático." : `El monto está a ${usd(dif)} del límite automático.`];
}

export const EXPLICACION_ERROR = "Error interno al evaluar: se escala por seguridad.";
