// Explicaciones en lenguaje natural (especificación §7). Salen de las evaluaciones, nunca del LLM.
// Orden: primero lo que frena, después lo que escala; dentro de cada grupo, R1 → R11. Se unen con "Además,".

import { correoDeInvitacion, esRemitenteInvitacion } from "@/dominio/remitente";
import { formatear, formatearBase, monedaBase, porcentaje } from "@/dominio/dinero";
import { sinPuntoDoble } from "@/dominio/normalizar";
import type { Beneficiario, DecisionAgente, DocumentoRecibido, EvaluacionRegla, Extraccion, IdRegla, Reglas } from "@/dominio/tipos";

import { diasEntre, esFechaValida, fechaDe, fechaLegible, horaDe } from "./fechas";
import { tolerancia } from "./r05-acordado";

/** Lo necesario para redactar la explicación de una decisión del motor. */
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

/** Monto en la moneda de las reglas (#86): "USD 3.000,00", "COP 12.600.000". */
const enBase = (centavos: number, reglas: Pick<Reglas, "moneda">) => formatearBase(centavos, monedaBase(reglas));
type Dato = EvaluacionRegla["datos"][string] | undefined;
const texto = (v: Dato) => (v === null || v === undefined ? "" : String(v));
const numero = (v: Dato) => (typeof v === "number" ? v : 0);

const CANAL: Record<DocumentoRecibido["canal"], string> = {
  correo: "correo",
  telegram: "mensaje de Telegram",
  whatsapp: "mensaje de WhatsApp",
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
  // Frenada, ninguna persona la decide (#149): no se pide confirmar los datos.
  R1: ({ e, d, de, x }) =>
    d.lectura === "sin_respuesta"
      ? `el agente no pudo leer el documento${de} porque el servicio de lectura no respondió.${x.decision === "FRENAR" ? "" : " Una persona debe revisarlo o pedir que se reenvíe."}`
      : `el agente no está seguro de lo que leyó en la factura${de} (${e.comparacion}).${x.decision === "FRENAR" ? "" : " Una persona debe confirmar los datos."}`,
  R2: fraseDuplicado,
  R3: ({ e, d, nombre, de, monto }) => {
    if (d.motivo === "sin_nit_factura") return `la factura${de} no trae la identificación fiscal (NIT) que la empresa exige para reconocer a quien cobra.`;
    if (d.motivo === "sin_nit_registrado") return `${nombre} no tiene identificación fiscal registrada y la empresa reconoce a quien cobra por nombre y NIT.`;
    if (d.motivo === "nit_distinto") return `la identificación fiscal de la factura (${texto(d.nit)}) no es la registrada para ${nombre} (${texto(d.nit_registrado)}).`;
    if (d.modo === "nit") return `la identificación fiscal ${texto(d.nit)} no es de ningún proveedor de la lista permitida.`;
    // Frena (2026-10-18): dice cuánto no se paga. Escala solo si llegó por un enlace de invitación (#85).
    if (e.si_falla === "FRENAR") return `la factura${de} (${monto}) no se paga: no está en la lista permitida.`;
    return `${nombre} no está en la lista de beneficiarios permitidos.`;
  },
  R4: ({ d, nombre }) =>
    `la cuenta de la factura (•••• ${texto(d.cuenta_factura)}) no es la registrada para ${nombre} (•••• ${texto(d.cuenta_registrada)}).`,
  R5: ({ d, nombre }) =>
    `${nombre} cobra ${texto(d.cobrado)}, pero ${texto(d.referencia)} acordó ${texto(d.acordado)} (${porcentaje(numero(d.diferencia_pct))}; la tolerancia es ${tolerancia(numero(d.tolerancia_pct))}).`,
  R6: ({ d, x, sujeto }) => `${sujeto} supera el máximo absoluto por pago de ${enBase(numero(d.maximo_usd), x.reglas)}.`,
  R7: ({ d, x, monto }) =>
    `el pago (${monto}) supera el presupuesto disponible de ${enBase(numero(d.disponible_usd), x.reglas)}, que ya descuenta lo reservado por escalados.`,
  R8: ({ d, x, nombre }) => {
    const periodo = x.reglas.presupuesto.periodo === "mensual" ? "el mes" : "el periodo";
    return `con este pago ${nombre} llegaría a ${enBase(numero(d.total_usd), x.reglas)} en ${periodo}, sobre su límite de ${enBase(numero(d.limite_usd), x.reglas)}.`;
  },
  R9: ({ d, x, sujeto }) => `${sujeto} supera el límite de pago automático de ${enBase(numero(d.limite_usd), x.reglas)}.`,
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
  const monto = x.monto_usd_centavos === null ? "el monto" : enBase(x.monto_usd_centavos, x.reglas);
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
  const montoTexto = original && original.moneda !== monedaBase(x.reglas) ? `${formatear(original)} = ${enBase(monto, x.reglas)}` : enBase(monto, x.reglas);
  return sinPuntoDoble(`Pagada: ${acuerdo}. ${cuenta}. Bajo el límite automático (${montoTexto} ≤ ${enBase(x.reglas.limites.pago_automatico_usd, x.reglas)}).`);
}

/**
 * Explicación de una decisión en una o más frases (§7): la causa que frena primero, después las que escalan, en orden
 * R1→R11, unidas con «Además,». ESCALAR cierra con lo que se reserva del presupuesto. El beneficiario se nombra una
 * sola vez.
 */
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
      ? ` Se reservan ${enBase(x.monto_usd_centavos, x.reglas)} del presupuesto mientras una persona decide.`
      : ` Monto por decidir: ${enBase(x.monto_usd_centavos, x.reglas)}.`;
  }
  return sinPuntoDoble(`${prefijo}: ${frases.join(" Además, ")}${cierre}`);
}

/**
 * Observaciones que no deciden (§7): el monto quedó a ≤ 1 % del límite automático, o la factura ya venció (#149).
 * Se muestran en la Traza para que quien revisa las vea.
 */
export function observaciones(monto_usd_centavos: number | null, reglas: Reglas, vencimiento?: { fecha: string | null; ahora: string }): string[] {
  const obs: string[] = [];
  const limite = reglas.limites.pago_automatico_usd;
  if (monto_usd_centavos !== null && monto_usd_centavos <= limite) {
    const dif = limite - monto_usd_centavos;
    if (dif * 100 <= limite) obs.push(dif === 0 ? "El monto es exactamente el límite automático." : `El monto está a ${enBase(dif, reglas)} del límite automático.`);
  }
  // Una factura vencida hace tiempo puede ser legítima (pago atrasado), pero quien revisa debe verlo (#149).
  const vence = vencimiento?.fecha;
  if (vence && esFechaValida(vence) && vence < fechaDe(vencimiento.ahora)) {
    const dias = diasEntre(vence, fechaDe(vencimiento.ahora));
    obs.push(`La factura venció hace ${dias === 1 ? "1 día" : `${dias} días`} (${fechaLegible(vence)}).`);
  }
  return obs;
}

/** Explicación cuando el motor falló: la factura escala por seguridad. */
export const EXPLICACION_ERROR = "Error interno al evaluar: se escala por seguridad.";
/** Explicación mientras la empresa no guarde sus reglas (versión 0): todo escala. */
export const EXPLICACION_SIN_REGLAS =
  "Escalada: la empresa aún no configuró sus reglas de pago, así que ninguna factura se paga ni se frena sola. Una persona debe decidir.";
