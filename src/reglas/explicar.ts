// Explicaciones en lenguaje natural (especificación §7). Salen de las evaluaciones, nunca del LLM.
// Orden: primero lo que frena, después lo que escala; dentro de cada grupo, R1 → R11. Se unen con "Además,".

import { correoDeInvitacion, esRemitenteInvitacion } from "@/dominio/remitente";
import { formatear, formatearUsd, porcentaje } from "@/dominio/dinero";
import type { Beneficiario, DecisionAgente, DocumentoRecibido, EvaluacionRegla, Extraccion, IdRegla, Reglas } from "@/dominio/tipos";

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
type Dato = EvaluacionRegla["datos"][string] | undefined;
const texto = (v: Dato) => (v === null || v === undefined ? "" : String(v));
const numero = (v: Dato) => (typeof v === "number" ? v : 0);

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

type Frase = {
  e: EvaluacionRegla;
  d: EvaluacionRegla["datos"];
  x: EntradaExplicacion;
  nombre: string;
  /** " de {nombre}" si todavía no se nombró; "" si ya */
  de: string;
  monto: string;
  /** "la factura de {nombre} (USD X)" o, si ya se nombró, "USD X" */
  sujeto: string;
};

function fraseDuplicado({ d, x, nombre }: Frase): string {
  const previa = texto(d.factura_previa);
  const momento = cuando(texto(d.momento_previo), x.ahora);
  const estado = d.estado_previo === "pagada" ? "pagada" : "escalada";
  if (d.criterio === "hito") return `${nombre} ya cobró el hito ${texto(d.hito)} con la factura ${previa}. Un hito se paga una sola vez.`;
  if (d.criterio === "archivo") return `${nombre} ya envió este mismo archivo (${previa}, ${estado} ${momento}). No se paga dos veces.`;
  if (d.criterio === "parecida")
    return `${nombre} ya cobró la factura ${previa} por casi el mismo monto y fecha (${estado} ${momento}). Puede ser un cobro repetido.`;
  if (estado === "pagada") return `${nombre} ya cobró la factura ${previa} y se pagó ${momento}. No se paga dos veces.`;
  return `${nombre} ya envió la factura ${previa} y quedó escalada ${momento}, pendiente de aprobación. No se paga dos veces.`;
}

const SIN_NOMBRE = "El beneficiario";

/** Una frase por regla que falla (§7). */
const FRASES: Record<IdRegla, (f: Frase) => string> = {
  R1: ({ e, d, de }) =>
    d.lectura === "sin_respuesta"
      ? `el agente no pudo leer el documento${de} porque el servicio de lectura no respondió. Una persona debe revisarlo o pedir que se reenvíe.`
      : `el agente no está seguro de lo que leyó en la factura${de} (${e.comparacion}). Una persona debe confirmar los datos.`,
  R2: fraseDuplicado,
  R3: ({ d, nombre }) => {
    if (d.motivo === "nit_distinto") return `la identificación fiscal de la factura (${texto(d.nit)}) no es la registrada para ${nombre} (${texto(d.nit_registrado)}).`;
    if (d.modo === "nit") return `la identificación fiscal ${texto(d.nit)} no es de ningún proveedor de la lista permitida.`;
    return `${nombre} no está en la lista de beneficiarios permitidos.`;
  },
  R4: ({ d, nombre }) =>
    `la cuenta de la factura (•••• ${texto(d.cuenta_factura)}) no es la registrada para ${nombre} (•••• ${texto(d.cuenta_registrada)}).`,
  R5: ({ d, nombre }) =>
    `${nombre} cobra ${texto(d.cobrado)}, pero ${texto(d.referencia)} acordó ${texto(d.acordado)} (${porcentaje(numero(d.diferencia_pct))}; la tolerancia es ${tolerancia(numero(d.tolerancia_pct))}).`,
  R6: ({ d, sujeto }) => `${sujeto} supera el máximo absoluto por pago de ${usd(numero(d.maximo_usd))}.`,
  R7: ({ d, monto }) =>
    `el pago (${monto}) supera el presupuesto disponible de ${usd(numero(d.disponible_usd))}, que ya descuenta lo reservado por escalados.`,
  R8: ({ d, x, nombre }) => {
    const periodo = x.reglas.presupuesto.periodo === "mensual" ? "el mes" : "el periodo";
    return `con este pago ${nombre} llegaría a ${usd(numero(d.total_usd))} en ${periodo}, sobre su límite de ${usd(numero(d.limite_usd))}.`;
  },
  R9: ({ d, sujeto }) => `${sujeto} supera el límite de pago automático de ${usd(numero(d.limite_usd))}.`,
  R10: ({ d, x, de }) => `el ${CANAL[x.doc.canal]}${de} traía instrucciones para el agente («${texto(d.frase ?? d.fragmento)}»); se ignoraron.`,
  R11: ({ x, nombre }) => {
    const v = x.doc.remitente.valor;
    // Enlace de invitación (#28): se nombra el correo verificado, no el id interno de la invitación.
    const quien = esRemitenteInvitacion(v) ? `enlace de invitación, ${correoDeInvitacion(v) ?? "correo sin verificar"}` : v;
    // Beneficiario fuera de la lista (R3 ya lo dijo): basta con decir que el remitente tampoco es conocido.
    if (!x.beneficiario) return `el remitente (${quien}) tampoco está vinculado.`;
    return `el remitente (${quien}) no está vinculado a ${nombre}.`;
  },
};

/** `nombrado`: si una frase anterior ya nombró al beneficiario, esta no lo repite. */
function fraseRegla(e: EvaluacionRegla, x: EntradaExplicacion, nombre: string, nombrado: boolean): string {
  const d = e.datos;
  if (e.resultado === "INDETERMINADO") {
    if (e.id === "R5") return `no se pudo asociar la factura a lo acordado con ${nombre} (${texto(d.motivo)}).`;
    if (e.id === "R3") return `no se pudo confirmar quién cobra: ${e.comparacion}.`;
    return `no se pudo evaluar «${e.nombre}» (${e.comparacion}).`;
  }
  // Sin nombre legible no se escribe "la factura de El beneficiario".
  const de = nombrado || nombre === SIN_NOMBRE ? "" : " de " + nombre;
  const monto = x.monto_usd_centavos === null ? "el monto" : usd(x.monto_usd_centavos);
  const sujeto = nombrado ? monto : "la factura" + de + " (" + monto + ")";
  return FRASES[e.id]({ e, d, x, nombre, de, monto, sujeto });
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
  const nombre = x.beneficiario?.nombre ?? x.ext.beneficiario_nombre.valor ?? SIN_NOMBRE;
  if (x.decision === "PAGAR") return explicarPago(x, nombre);
  if (x.decision === "RECHAZADA_NO_FACTURA") {
    return `Rechazada: el documento no es una factura (confianza ${Math.floor(x.ext.es_factura.confianza * 100)}%); no entra a las reglas de pago.`;
  }

  const fallas = x.evaluaciones.filter((e) => e.resultado === "FALLA" || e.resultado === "INDETERMINADO");
  const frenan = fallas.filter((e) => e.si_falla === "FRENAR" && e.resultado === "FALLA");
  const resto = fallas.filter((e) => !frenan.includes(e));
  const frases: string[] = [];
  // Reenvío interno (carga manual, empleado de la empresa): R11 falla solo porque falló R3; sería repetir la misma causa.
  const r3Falla = fallas.some((e) => e.id === "R3" && e.resultado === "FALLA");
  const interno = x.doc.remitente.tipo === "interno";
  // LLM sin respuesta y sin nombre legible (#103): R3 y R11 fallan solo porque no se leyó nada; la traza las conserva.
  const sinLectura = nombre === SIN_NOMBRE && fallas.some((e) => e.id === "R1" && e.datos.lectura === "sin_respuesta");
  const unidas = [...frenan, ...resto].filter(
    (e) => !(e.id === "R11" && e.resultado === "FALLA" && interno && r3Falla) && !(sinLectura && (e.id === "R3" || e.id === "R11")),
  );
  for (const e of unidas) frases.push(fraseRegla(e, x, nombre, frases.some((f) => f.includes(nombre))));
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
export const EXPLICACION_SIN_REGLAS =
  "Escalada: la empresa aún no configuró sus reglas de pago, así que ninguna factura se paga ni se frena sola. Una persona debe decidir.";
