// Mensajes del bot de WhatsApp (#79) con el formato de WhatsApp: *negrita*, ```monoespaciado``` y saltos de línea.
// El contenido sale de `resumenRespuesta` (mismo filtro que correo y Telegram: nunca reglas internas, límites ni
// montos de la empresa); aquí solo cambia la presentación. Sin cursiva (_texto_), como en el resto del producto.

import type { EntradaRegistro, Idioma } from "@/dominio/tipos";
import { resumenRespuesta } from "@/ingesta/respuesta";

type Etiquetas = {
  recibida: string;
  documento: string;
  factura: string;
  referencia: string;
  estado: string;
  pagar: string;
  escalar: string;
  frenar: string;
  detalle_pagar: string;
  detalle_escalar: string;
  motivo: string;
  no_factura: string;
  consultar: (ref: string) => string;
};

const ETIQUETAS: Record<Idioma, Etiquetas> = {
  es: {
    recibida: "Factura recibida",
    documento: "Documento recibido",
    factura: "Factura",
    referencia: "Referencia",
    estado: "Estado",
    pagar: "Aprobada para pago 🟢",
    escalar: "En revisión 🟡",
    frenar: "No se pagará 🔴",
    detalle_pagar: "Todo en orden. Te avisamos cualquier novedad.",
    detalle_escalar: "El equipo de finanzas la está revisando.",
    motivo: "Motivo",
    no_factura: "No lo reconocimos como factura, así que no entra a pago. Si es una factura, envíala de nuevo en PDF.",
    consultar: (ref) => `Para consultarla escribe: *ESTADO ${ref}*`,
  },
  en: {
    recibida: "Invoice received",
    documento: "Document received",
    factura: "Invoice",
    referencia: "Reference",
    estado: "Status",
    pagar: "Approved for payment 🟢",
    escalar: "Under review 🟡",
    frenar: "It will not be paid 🔴",
    detalle_pagar: "All good. We will let you know if anything changes.",
    detalle_escalar: "The finance team is reviewing it.",
    motivo: "Reason",
    no_factura: "We did not recognize it as an invoice, so it was not sent to payment. If it is an invoice, please send it again as a PDF.",
    consultar: (ref) => `To check it, write: *ESTADO ${ref}*`,
  },
  pt: {
    recibida: "Fatura recebida",
    documento: "Documento recebido",
    factura: "Fatura",
    referencia: "Referência",
    estado: "Status",
    pagar: "Aprovada para pagamento 🟢",
    escalar: "Em revisão 🟡",
    frenar: "Não será paga 🔴",
    detalle_pagar: "Tudo certo. Avisamos se houver novidades.",
    detalle_escalar: "A equipe financeira está revisando.",
    motivo: "Motivo",
    no_factura: "Não o reconhecemos como fatura, por isso não segue para pagamento. Se for uma fatura, envie-a novamente em PDF.",
    consultar: (ref) => `Para consultar, escreva: *ESTADO ${ref}*`,
  },
};

const ICONO = { pagar: "✅", escalar: "⏳", frenar: "⛔", no_factura: "📎" } as const;

/** Respuesta a una factura recibida, lista para enviar por WhatsApp. */
export function mensajeFactura(entrada: EntradaRegistro, idioma: Idioma): string {
  const e = ETIQUETAS[idioma];
  const r = resumenRespuesta(entrada, idioma);
  const lineas = [`${ICONO[r.estado]} *${r.estado === "no_factura" ? e.documento : e.recibida}*`, ""];
  if (r.numero) lineas.push(`📄 ${e.factura}: *${r.numero}*`);
  lineas.push(`🔖 ${e.referencia}: \`\`\`${r.ref}\`\`\``);
  if (r.estado === "no_factura") {
    lineas.push("", e.no_factura);
    return lineas.join("\n");
  }
  lineas.push(`📌 ${e.estado}: *${e[r.estado]}*`, "");
  if (r.estado === "pagar") lineas.push(e.detalle_pagar);
  else if (r.estado === "frenar") lineas.push(`${e.motivo}: ${r.motivo ?? ""}.`);
  else lineas.push(e.detalle_escalar);
  if (r.vincular) lineas.push("", `🔗 ${r.vincular}`);
  lineas.push("", e.consultar(r.ref));
  return lineas.join("\n");
}
