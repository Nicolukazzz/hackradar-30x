// Parser sin IA por etiquetas en ES/EN/PT. Lo comparten PDF con texto, correo y chat.
//
// Entrada: líneas de texto en orden de lectura. En PDF las celdas de un mismo renglón vienen
// separadas por " | " ("Issue date | Oct 8, 2026"); en chat y correo, "Etiqueta: valor".
// Confianza: 0,99 si la etiqueta aparece y el valor valida; 0,6 si se infirió sin etiqueta;
// el campo no aparece en el resultado si no se encontró (y entonces se consulta al LLM).

import type { Campo, Dinero, Idioma } from "@/dominio/tipos";

import {
  CONFIANZA_ETIQUETA,
  CONFIANZA_INFERIDA,
  type ExtraccionParcial,
  type NombreCampo,
  type ValoresCampos,
} from "../tipos";
import { aDinero, parsearFecha, PATRON_FECHA, PATRON_MONTO } from "./valores";

/** Separador de celdas o de etiqueta y valor. */
const SEP = String.raw`\s*[:|]\s*`;

const TITULO = String.raw`(?:FACTURA\s+N\.?\s*[º°o]\.?|CUENTA\s+DE\s+COBRO\s+N\.?\s*[º°o]\.?|INVOICE\s*(?:#|No\.?|Number)|FATURA\s+N\.?\s*[º°o]\.?|FACTURA\s+ELECTR[OÓ]NICA)`;
const RE_TITULO = new RegExp(`^\\s*${TITULO}\\s*(?:[:|]\\s*)?(.*)$`, "i");
/** Chat: "Factura F-0101" al inicio de la línea. */
const RE_TITULO_SIMPLE = /^\s*(?:Factura|Invoice|Fatura|Cuenta de cobro)\s+([A-Z0-9][A-Z0-9/-]*\d[A-Z0-9/-]*)\s*$/i;
const RE_CODIGO = /^[A-Z0-9][A-Z0-9/-]*\d[A-Z0-9/-]*$/i;

/** La etiqueta no puede ser la cola de otra ("Due date" no es "Date"). */
const INICIO = String.raw`(?<![A-Za-zÀ-ÿ]\s?)`;

const RE_EMISION = new RegExp(
  `${INICIO}(?:Fecha\\s+de\\s+emisi[oó]n|Fecha\\s+de\\s+expedici[oó]n|Issue\\s+date|Invoice\\s+date|Data\\s+de\\s+emiss[aã]o|Fecha|Date|Data)${SEP}${PATRON_FECHA}`,
  "i",
);
const RE_VENCE = new RegExp(`${INICIO}(?:Fecha\\s+de\\s+vencimiento|Vencimiento|Vence|Due\\s+date|Due|Vencimento)${SEP}${PATRON_FECHA}`, "i");

/** "Total" pero no "Subtotal". "Valor" solo con monto al lado (en PT también es cabecera de columna). */
const RE_TOTAL = new RegExp(`(?<![A-Za-z])(?:Total(?:\\s+a\\s+pagar|\\s+due)?|Amount\\s+due|Valor(?:\\s+total)?)${SEP}${PATRON_MONTO}`, "i");
const RE_SUBTOTAL = new RegExp(`(?<![A-Za-z])Subtotal${SEP}${PATRON_MONTO}`, "i");
const RE_IMPUESTOS = new RegExp(
  `(?<![A-Za-z])(?:IVA|VAT|Taxes|Tax|Impuestos?|Impostos?|ICMS|ISS|IGV)\\b[^|:\\n]*${SEP}${PATRON_MONTO}`,
  "i",
);

const ETIQUETA_CUENTA = String.raw`(?:Cuenta\s+de\s+ahorros|Cuenta\s+corriente|Conta\s+corrente|Account(?:\s+number)?|Cuenta|Conta|CLABE|CBU|PIX|IBAN)`;
const RE_CUENTA = new RegExp(`${ETIQUETA_CUENTA}\\s*(?:N\\.?\\s*[º°o]\\.?)?\\s*:?\\s*(\\d[\\d -]{6,}\\d)`, "gi");
/** "•••• 4471", "CLABE nueva …9083": hasta tres palabras entre el rótulo y la máscara. */
const RE_CUENTA_ENMASCARADA = new RegExp(
  `${ETIQUETA_CUENTA}(?:\\s+[\\p{L}]+){0,3}\\s*:?\\s*(?:…|\\.{3}|(?:[•*·x]\\s*){2,})\\s*(\\d{4})\\b`,
  "giu",
);

/** Identificación fiscal (#108): NIT, RUT, RFC, CUIT, CNPJ, CPF, RUC, EIN/TIN, Tax ID, VAT No. El valor, sin espacios. */
const RE_IDENTIFICACION =
  /(?<![A-Za-z])(?:N\.?I\.?T\.?|RUT|RFC|CUIT|CNPJ|CPF|RUC|EIN|TIN|Tax\s*ID|VAT\s*(?:No\.?|Number|ID))(?:\s*N\.?\s*[º°o]\.?)?\s*[:#]?\s*([A-Z0-9][A-Z0-9./-]{3,24})/gi;
/** Rótulo del cliente: su NIT (el de quien paga) no es el de quien cobra. Se ignora ese renglón y los 3 siguientes. */
const RE_CLIENTE = /^\s*(?:Facturar\s+a|Facturado\s+a|Cliente|Adquiriente|Se[ñn]or(?:es)?|Bill\s+to|Billed\s+to|Customer|Cobrar\s+a|Tomador)\b/i;
const LINEAS_CLIENTE = 3;

const RE_PAGAR = /^\s*(?:Pagar\s+a|Pay\s+to|Payee|Beneficiario|Benefici[aá]rio)\s*:?\s*(.*)$/i;
const RE_CABECERA_CONCEPTO = /^\s*(?:Concepto|Description|Descripci[oó]n|Descri[cç][aã]o|Detalle)\s*\|\s*(?:Importe|Amount|Valor|Monto)\s*$/i;
const RE_CONCEPTO_ETIQUETADO = /^\s*(?:Concepto|Description|Descripci[oó]n|Descri[cç][aã]o|Detalle)\s*:\s*(.+)$/i;
const RE_REFERENCIA = /^\s*(?:Referencia|Reference|Refer[eê]ncia|Ref\.?)\s*:\s*(.+)$/i;
/** Al final del concepto en chat: "(CT-JPO, hito 2 de 3)" o "(DH-ONCALL)". Solo códigos, nada de texto libre. */
const RE_REF_EN_PARENTESIS = /\s*\(([A-Z]{2,}(?:-[A-Z0-9]+)*)(?:,\s*hito\s+(\d+)\s+de\s+\d+)?\)\s*$/;
const RE_REF_INFERIDA = /\b(OC-\d+|DH-[A-Z]+)\b/;
const RE_HITO = /\bhito\s+(\d+)\b/i;
/** Caracteres (sin espacios) que debe tener un texto para descartar con confianza que sea factura. */
const MINIMO_TEXTO_NO_FACTURA = 120;
const RE_PALABRAS_COBRO = /\b(factura|invoice|fatura|cuenta de cobro|cobro|total|amount|importe|subtotal|IVA|pagar|pay|payment|pago|pagamento|vence|due|vencimento)\b/i;

function campo<T>(valor: T, confianza: number): Campo<T> {
  return { valor, confianza, fuente: "parser" };
}

function celdas(linea: string): string[] {
  return linea.split(" | ").map((c) => c.trim()).filter(Boolean);
}

function siguienteNoVacia(lineas: string[], i: number): string | null {
  for (let j = i + 1; j < lineas.length; j++) {
    const primera = celdas(lineas[j] ?? "")[0];
    if (primera) return primera;
  }
  return null;
}

function primerMatch(lineas: string[], re: RegExp): RegExpExecArray | null {
  for (const l of lineas) {
    const m = re.exec(l);
    if (m) return m;
  }
  return null;
}

/** Idioma por las etiquetas que usa el documento. Por defecto, español. */
export function detectarIdioma(texto: string): Idioma {
  if (/\b(FATURA|Vencimento|Data de emiss[aã]o|Descri[cç][aã]o|Faturar para|Observa[cç][oõ]es)\b/i.test(texto)) return "pt";
  if (/\b(INVOICE|Issue date|Due date|Bill to|Pay to)\b/i.test(texto)) return "en";
  return "es";
}

/** `chat` además separa la referencia que el remitente pone entre paréntesis al final del concepto. */
export type ModoParser = "documento" | "chat";

/**
 * Lee campos por etiqueta. `modo: "chat"` además separa la referencia que el remitente anota
 * entre paréntesis al final del concepto ("Soporte on-call — octubre (DH-ONCALL)").
 */
export function parsearLineas(lineas: string[], modo: ModoParser): ExtraccionParcial {
  const r: ExtraccionParcial = {};
  const poner = <K extends NombreCampo>(k: K, valor: ValoresCampos[K] | null, confianza: number) => {
    if (valor !== null && r[k] === undefined) (r as Record<string, unknown>)[k] = campo(valor, confianza);
  };

  // Número: "FACTURA N.º" con el código en la misma línea o en la siguiente; en chat "Factura F-0101".
  let tieneTitulo = false;
  lineas.forEach((l, i) => {
    if (r.numero) return;
    const m = RE_TITULO.exec(l);
    if (m) {
      tieneTitulo = true;
      // En el PDF el código va debajo del rótulo, pero el nombre del emisor puede quedar entre ambos.
      const candidatos = [celdas(m[1] ?? "")[0] ?? "", ...lineas.slice(i + 1, i + 4).map((x) => celdas(x)[0] ?? "")];
      const codigo = candidatos.find((c) => RE_CODIGO.test(c));
      if (codigo) poner("numero", codigo.toUpperCase(), CONFIANZA_ETIQUETA);
      return;
    }
    const s = RE_TITULO_SIMPLE.exec(l);
    if (s?.[1]) {
      tieneTitulo = true;
      poner("numero", s[1].toUpperCase(), CONFIANZA_ETIQUETA);
    }
  });

  const emision = primerMatch(lineas, RE_EMISION);
  poner("fecha_emision", emision?.[1] ? parsearFecha(emision[1]) : null, CONFIANZA_ETIQUETA);
  const vence = primerMatch(lineas, RE_VENCE);
  poner("fecha_vencimiento", vence?.[1] ? parsearFecha(vence[1]) : null, CONFIANZA_ETIQUETA);

  // Montos.
  const total = primerMatch(lineas, RE_TOTAL);
  poner("monto_total", total?.[1] && total[2] ? aDinero(total[1], total[2]) : null, CONFIANZA_ETIQUETA);
  if (!r.monto_total) {
    // Sin etiqueta: solo si en todo el documento aparece un único monto distinto.
    const montos = new Map<string, Dinero>();
    for (const l of lineas) {
      for (const m of l.matchAll(new RegExp(PATRON_MONTO, "gi"))) {
        const d = m[1] && m[2] ? aDinero(m[1], m[2]) : null;
        if (d) montos.set(`${d.moneda}:${d.centavos}`, d);
      }
    }
    if (montos.size === 1) poner("monto_total", [...montos.values()][0] ?? null, CONFIANZA_INFERIDA);
  }
  const subtotal = primerMatch(lineas, RE_SUBTOTAL);
  poner("subtotal", subtotal?.[1] && subtotal[2] ? aDinero(subtotal[1], subtotal[2]) : null, CONFIANZA_ETIQUETA);
  const impuestos = primerMatch(lineas, RE_IMPUESTOS);
  poner("impuestos", impuestos?.[1] && impuestos[2] ? aDinero(impuestos[1], impuestos[2]) : null, CONFIANZA_ETIQUETA);

  // Cuenta destino: todas las menciones deben coincidir; si no, se toma la última con confianza baja (R1 escala).
  const ultimos4 = new Set<string>();
  let ultima: string | null = null;
  for (const l of lineas) {
    for (const m of [...l.matchAll(RE_CUENTA), ...l.matchAll(RE_CUENTA_ENMASCARADA)]) {
      const digitos = (m[1] ?? "").replace(/\D/g, "");
      if (digitos.length >= 4) {
        ultima = digitos.slice(-4);
        ultimos4.add(ultima);
      }
    }
  }
  poner("cuenta_destino_ultimos4", ultima, ultimos4.size === 1 ? CONFIANZA_ETIQUETA : 0.5);

  // Identificación fiscal de quien cobra (#108): la primera con etiqueta fuera del bloque del cliente. Si quedan varias
  // distintas, confianza baja: en modo NIT, R3 escala en vez de adivinar.
  const identificaciones: string[] = [];
  let cliente = -1;
  lineas.forEach((l, i) => {
    if (RE_CLIENTE.test(l)) cliente = i;
    if (cliente >= 0 && i - cliente <= LINEAS_CLIENTE) return;
    for (const m of l.matchAll(RE_IDENTIFICACION)) {
      const valor = (m[1] ?? "").replace(/[./-]+$/, "");
      if ((valor.match(/\d/g) ?? []).length >= 4) identificaciones.push(valor);
    }
  });
  const distintas = new Set(identificaciones.map((v) => v.replaceAll(/[^0-9A-Za-z]/g, "").toUpperCase()));
  poner("identificacion_fiscal", identificaciones[0] ?? null, distintas.size === 1 ? CONFIANZA_ETIQUETA : 0.5);

  // Beneficiario: "Pagar a: Nombre · Banco · Cuenta" o la línea siguiente al rótulo "PAGAR A".
  lineas.forEach((l, i) => {
    if (r.beneficiario_nombre) return;
    const m = RE_PAGAR.exec(l);
    if (!m) return;
    const nombre = (m[1] ?? "").split(" · ")[0]?.trim() || siguienteNoVacia(lineas, i);
    poner("beneficiario_nombre", nombre || null, CONFIANZA_ETIQUETA);
  });

  // Concepto y referencia al acuerdo.
  let refParentesis: { ref: string; hito: number | null } | null = null;
  for (const [i, l] of lineas.entries()) {
    if (RE_CABECERA_CONCEPTO.test(l)) {
      poner("concepto", siguienteNoVacia(lineas, i), CONFIANZA_ETIQUETA);
      break;
    }
    const m = RE_CONCEPTO_ETIQUETADO.exec(l);
    if (!m?.[1]) continue;
    let concepto = m[1].trim();
    const p = modo === "chat" ? RE_REF_EN_PARENTESIS.exec(concepto) : null;
    if (p?.[1]) {
      refParentesis = { ref: p[1], hito: p[2] ? Number(p[2]) : null };
      concepto = concepto.slice(0, p.index).trim();
    }
    poner("concepto", concepto || null, CONFIANZA_ETIQUETA);
    break;
  }

  const ref = primerMatch(lineas, RE_REFERENCIA);
  if (ref?.[1]) {
    const [codigo, ...resto] = ref[1].split(" · ");
    poner("referencia_acuerdo", codigo?.trim() || null, CONFIANZA_ETIQUETA);
    const hito = RE_HITO.exec(resto.join(" "));
    poner("hito_numero", hito?.[1] ? Number(hito[1]) : null, CONFIANZA_ETIQUETA);
  } else if (refParentesis) {
    const { ref: codigo, hito } = refParentesis;
    poner("referencia_acuerdo", codigo, CONFIANZA_ETIQUETA);
    poner("hito_numero", hito, CONFIANZA_ETIQUETA);
  } else {
    const inferida = r.concepto?.valor ? RE_REF_INFERIDA.exec(r.concepto.valor) : null;
    poner("referencia_acuerdo", inferida?.[1] ?? null, CONFIANZA_INFERIDA);
  }

  // ¿Es factura? Título + número + total → sí. Señales parciales → sí, con poca confianza (consulta al LLM).
  // "No" con confianza alta solo si el texto no tiene ni un monto ni una palabra de cobro (folleto, aviso):
  // una factura con un formato que el parser no conoce nunca se rechaza sin que la mire el LLM o una persona.
  const texto = lineas.join("\n");
  const senales = [tieneTitulo, Boolean(r.numero), Boolean(r.monto_total)].filter(Boolean).length;
  const pareceCobro = RE_PALABRAS_COBRO.test(texto) || new RegExp(PATRON_MONTO, "i").test(texto) || /[$€]\s?\d/.test(texto);
  // Poco texto (pie de un escáner, una línea suelta) no basta para descartar: puede ser una factura escaneada.
  const contenido = texto.replace(/\s/g, "").length;
  if (senales === 3) poner("es_factura", true, CONFIANZA_ETIQUETA);
  else if (senales > 0) poner("es_factura", true, CONFIANZA_INFERIDA);
  else if (contenido >= MINIMO_TEXTO_NO_FACTURA && !pareceCobro) poner("es_factura", false, 0.95);
  else if (contenido > 0) poner("es_factura", false, CONFIANZA_INFERIDA);

  if (texto.trim()) r.idioma = detectarIdioma(texto);
  return r;
}
