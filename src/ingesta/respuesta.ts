// Aviso al remitente por su canal (§8 paso 8). Le dice qué pasó con su documento y su ref interna,
// pero nunca revela reglas internas: ni límites, ni presupuesto, ni montos de la empresa, ni ids de reglas.

import type { Canal, EntradaRegistro, Idioma, IdRegla } from "@/dominio/tipos";

export type OpcionesRespuesta = {
  /**
   * Enlace para vincular el chat o el correo (R11), si el canal tiene uno (p. ej. `t.me/<bot>?start=…` que genera la
   * empresa). Sin enlace se le dice al proveedor que lo pida a su contacto: desde #49 no hay portal de proveedores.
   */
  urlVincular?: string;
};

type Textos = {
  recibida: (numero: string | null, ref: string) => string;
  pagar: string;
  escalar: string;
  frenar: (motivo: string) => string;
  no_factura: (ref: string) => string;
  motivos: { repetida: string; no_cuadra: string; general: string };
  vincular: (medio: string, url: string | undefined) => string;
  medio: Record<Canal, string>;
};

const TEXTOS: Record<Idioma, Textos> = {
  es: {
    recibida: (n, ref) => `Recibimos tu factura${n ? ` ${n}` : ""}. Ref ${ref}.`,
    pagar: "Estado: aprobada para pago.",
    escalar: "Estado: en revisión por el equipo de finanzas.",
    frenar: (m) => `Estado: no se pagará: ${m}.`,
    no_factura: (ref) => `Recibimos tu documento. Ref ${ref}. No lo reconocimos como factura, así que no entra a pago. Si es una factura, envíala de nuevo en PDF.`,
    motivos: {
      repetida: "ya habíamos recibido esta factura",
      no_cuadra: "el monto o el concepto no coincide con lo acordado",
      general: "el equipo de finanzas te contactará",
    },
    vincular: (medio, url) =>
      url
        ? `Para que tus facturas se procesen automáticamente, vincula este ${medio}: ${url}`
        : `Para que tus facturas se procesen automáticamente, pide a tu contacto en el equipo de finanzas el enlace para vincular este ${medio}.`,
    medio: { correo: "correo", telegram: "chat", whatsapp: "número de WhatsApp", portal: "usuario", carga_manual: "medio" },
  },
  en: {
    recibida: (n, ref) => `We received your invoice${n ? ` ${n}` : ""}. Ref ${ref}.`,
    pagar: "Status: approved for payment.",
    escalar: "Status: under review by the finance team.",
    frenar: (m) => `Status: it will not be paid: ${m}.`,
    no_factura: (ref) => `We received your document. Ref ${ref}. We did not recognize it as an invoice, so it was not sent to payment. If it is an invoice, please send it again as a PDF.`,
    motivos: {
      repetida: "we had already received this invoice",
      no_cuadra: "the amount or description does not match what was agreed",
      general: "the finance team will contact you",
    },
    vincular: (medio, url) =>
      url
        ? `To have your invoices processed automatically, link this ${medio}: ${url}`
        : `To have your invoices processed automatically, ask your contact on the finance team for the link to connect this ${medio}.`,
    medio: { correo: "email address", telegram: "chat", whatsapp: "WhatsApp number", portal: "user", carga_manual: "channel" },
  },
  pt: {
    recibida: (n, ref) => `Recebemos sua fatura${n ? ` ${n}` : ""}. Ref ${ref}.`,
    pagar: "Status: aprovada para pagamento.",
    escalar: "Status: em revisão pela equipe financeira.",
    frenar: (m) => `Status: não será paga: ${m}.`,
    no_factura: (ref) => `Recebemos seu documento. Ref ${ref}. Não o reconhecemos como fatura, por isso não segue para pagamento. Se for uma fatura, envie-a novamente em PDF.`,
    motivos: {
      repetida: "já tínhamos recebido esta fatura",
      no_cuadra: "o valor ou a descrição não corresponde ao combinado",
      general: "a equipe financeira entrará em contato",
    },
    vincular: (medio, url) =>
      url
        ? `Para que suas faturas sejam processadas automaticamente, vincule este ${medio}: ${url}`
        : `Para que suas faturas sejam processadas automaticamente, peça ao seu contato na equipe financeira o link para vincular este ${medio}.`,
    medio: { correo: "e-mail", telegram: "chat", whatsapp: "número de WhatsApp", portal: "usuário", carga_manual: "canal" },
  },
};

/** Motivo para el proveedor. R6 (máximo) y R7 (presupuesto) son internos: se dice solo que finanzas contactará. */
function motivoFrenar(reglas: readonly IdRegla[], t: Textos): string {
  if (reglas.includes("R2")) return t.motivos.repetida;
  if (reglas.includes("R5")) return t.motivos.no_cuadra;
  return t.motivos.general;
}

/** Lo que se le puede decir al remitente, ya filtrado (sin reglas internas). Base de `textoRespuesta` y de los formatos por canal. */
export type ResumenRespuesta = {
  estado: "pagar" | "escalar" | "frenar" | "no_factura";
  ref: string;
  /** null si no se le confirma (R11) o no se leyó */
  numero: string | null;
  /** motivo para el proveedor si se frena */
  motivo: string | null;
  /** frase para vincular el canal (solo si falló R11) */
  vincular: string | null;
};

export function resumenRespuesta(entrada: EntradaRegistro, idioma: Idioma, opciones: OpcionesRespuesta = {}): ResumenRespuesta {
  const t = TEXTOS[idioma];
  const base = { ref: entrada.ref_interna, numero: entrada.factura_numero, motivo: null, vincular: null };
  if (entrada.decision === "RECHAZADA_NO_FACTURA") return { ...base, estado: "no_factura", numero: null };
  // Remitente no verificado (R11): puede ser alguien suplantando al proveedor. No se le confirma el número de
  // factura ni si ya existía: solo la ref de su envío, "en revisión" y cómo vincular su canal.
  if (entrada.reglas_que_fallaron.includes("R11")) {
    return { ...base, estado: "escalar", numero: null, vincular: t.vincular(t.medio[entrada.canal], opciones.urlVincular) };
  }
  if (entrada.decision === "PAGAR") return { ...base, estado: "pagar" };
  if (entrada.decision === "FRENAR") return { ...base, estado: "frenar", motivo: motivoFrenar(entrada.reglas_que_fallaron, t) };
  return { ...base, estado: "escalar" };
}

export function textoRespuesta(entrada: EntradaRegistro, idioma: Idioma, opciones: OpcionesRespuesta = {}): string {
  const t = TEXTOS[idioma];
  const r = resumenRespuesta(entrada, idioma, opciones);
  if (r.estado === "no_factura") return t.no_factura(r.ref);
  const partes = [t.recibida(r.numero, r.ref)];
  if (r.estado === "pagar") partes.push(t.pagar);
  else if (r.estado === "frenar") partes.push(t.frenar(r.motivo ?? t.motivos.general));
  else partes.push(t.escalar);
  if (r.vincular) partes.push(r.vincular);
  return partes.join(" ");
}
