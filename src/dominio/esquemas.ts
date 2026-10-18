// Esquemas zod de todo lo que entra por disco o HTTP. Son estrictos: un campo de más
// o mal escrito es un error, no se ignora. Deben coincidir exactamente con tipos.ts
// (lo comprueba tests/dominio/esquemas.test.ts en compilación).

import { z } from "zod";

import {
  CAMPOS_REQUERIBLES,
  ID_REGLAS,
  MONEDAS,
  REGLAS_EDITABLES,
  TRAMPAS,
  type Acuerdo,
  type Aprobador,
  type Beneficiario,
  type ConfigEscenario,
  type Dinero,
  type DocumentoEntrante,
  type Empresa,
  type EntradaRegistro,
  type EsperadoDocumento,
  type EvaluacionRegla,
  type Extraccion,
  type ExtraccionPlana,
  type MetaDocumento,
  type Reglas,
  type TablaTasas,
} from "./tipos";

const centavos = z.int().nonnegative();
const fecha = z.iso.date();
/** Momento ISO-8601 válido con zona (Z o ±hh:mm). Exportado para reloj.ts. */
export const MomentoSchema = z.iso.datetime({ offset: true });
const momento = MomentoSchema;
const texto = z.string().min(1);
/** "4200.00", "18.50", "1": decimal estrictamente positivo como string (nunca float; 0 dividiría por cero). */
const tasa = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "tasa debe ser un decimal en texto, p. ej. \"18.50\"")
  .refine((v) => Number(v) > 0, "la tasa debe ser mayor que 0");

export const MonedaSchema = z.enum(MONEDAS);
export const IdReglaSchema = z.enum(ID_REGLAS);

export const DineroSchema = z.strictObject({ centavos, moneda: MonedaSchema }) satisfies z.ZodType<Dinero>;

export const EmpresaSchema = z.strictObject({
  id: texto,
  nombre: texto,
  jurisdiccion: texto,
  paises_operacion: z.array(z.string().length(2)).min(1),
  moneda_base: MonedaSchema,
  zona_horaria: texto,
}) satisfies z.ZodType<Empresa>;

export const TablaTasasSchema = z.strictObject({
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  base: MonedaSchema,
  tasas: z.partialRecord(MonedaSchema, tasa),
}) satisfies z.ZodType<TablaTasas>;

const tipoPeriodo = z.enum(["mensual", "quincenal", "trimestral"]);

/**
 * Reglas válidas para guardar o simular. Además del formato exige: pago automático (R9) ≤ máximo (R6), solo R5 y R8
 * desactivables, confianza mínima ≥ 50 % y tolerancia de lo acordado ≤ 50 %.
 */
export const ReglasSchema = z
  .strictObject({
    version: z.int().nonnegative(), // 0 = sin configurar (#106): nunca se guarda, solo se muestra y se simula
    editada_por: texto,
    editada_en: momento,
    limites: z.strictObject({
      pago_automatico_usd: centavos,
      maximo_absoluto_usd: centavos,
      mensual_por_beneficiario_default_usd: centavos,
      // Tope de seguridad: con más de 50 % «cuadra con lo acordado» dejaría de frenar casi cualquier cobro inflado.
      tolerancia_acordado_pct: z.number().nonnegative().max(50, "la tolerancia de lo acordado (R5) no puede pasar de 50 %"),
    }),
    presupuesto: z.strictObject({ periodo: tipoPeriodo, monto_usd: centavos, contar_escalado_como_reservado: z.boolean() }),
    duplicados: z.strictObject({
      ventana_dias: z.int().positive(),
      tolerancia_monto_pct: z.number().nonnegative(),
      tolerancia_fecha_dias: z.int().nonnegative(),
    }),
    // Piso de seguridad: con menos de 50 % R1 dejaría pasar datos que el agente no leyó con seguridad.
    extraccion: z.strictObject({ confianza_minima: z.number().min(0.5, "la confianza mínima de lectura (R1) no puede ser menor a 50 %").max(1) }),
    aprobacion: z.strictObject({ doble_aprobacion_desde_usd: centavos }),
    activas: z.record(IdReglaSchema, z.boolean()),
    moneda: MonedaSchema.optional(),
    identidad: z.strictObject({ modo: z.enum(["nombre", "nombre_y_nit", "nit"]) }).optional(),
    requisitos: z.strictObject({ obligatorios: z.array(z.enum(CAMPOS_REQUERIBLES)).max(CAMPOS_REQUERIBLES.length) }).optional(),
  })
  .refine((r) => r.limites.pago_automatico_usd <= r.limites.maximo_absoluto_usd, {
    message: "el límite de pago automático (R9) no puede superar el máximo absoluto (R6)",
    path: ["limites", "pago_automatico_usd"],
  })
  .refine((r) => ID_REGLAS.every((id) => REGLAS_EDITABLES.includes(id) || r.activas[id]), {
    message: `solo ${REGLAS_EDITABLES.join(" y ")} se pueden desactivar (especificación §4.2)`,
    path: ["activas"],
  }) satisfies z.ZodType<Reglas>;

export const AcuerdoSchema = z.strictObject({
  tipo: z.enum(["contrato_mensual", "orden_compra", "hitos", "honorario", "licencia"]),
  referencia: texto,
  descripcion: texto,
  lineas: z
    .array(
      z.strictObject({
        codigo: texto,
        concepto: texto,
        palabras_clave: z.array(texto).min(1),
        monto: DineroSchema,
        hitos_total: z.int().positive().optional(),
      }),
    )
    .min(1),
}) satisfies z.ZodType<Acuerdo>;

export const BeneficiarioSchema = z.strictObject({
  id: texto,
  nombre: texto,
  identificacion_fiscal: texto.nullable().optional(),
  pais: z.string().length(2),
  categoria: texto,
  tipo: z.enum(["contratista", "proveedor"]),
  cuenta: z.strictObject({
    tipo: z.enum(["CLABE", "cuenta", "PIX", "CBU", "ACH"]),
    banco: texto,
    numero_enmascarado: texto,
    ultimos4: z.string().regex(/^\d{4}$/),
  }),
  acuerdo: AcuerdoSchema.nullable(),
  limite_mensual_usd: centavos.nullable(),
  estado: z.enum(["activo", "inactivo"]),
  canales: z.strictObject({
    correos: z.array(z.email()),
    telegram_chat_id: texto.nullable(),
    portal_usuario: texto.nullable(),
    whatsapp: z.string().regex(/^\d{6,20}$/).nullable().optional(),
  }),
}) satisfies z.ZodType<Beneficiario>;

/** Ids únicos y cada canal vinculado a un solo beneficiario (si no, R11 sería ambiguo). */
export const BeneficiariosSchema = z.array(BeneficiarioSchema).superRefine((lista, ctx) => {
  const ids = new Set<string>();
  const duenoDeCanal = new Map<string, string>();
  for (const b of lista) {
    if (ids.has(b.id)) ctx.addIssue({ code: "custom", message: `id de beneficiario repetido: ${b.id}` });
    ids.add(b.id);
    const canales = [
      ...b.canales.correos.map((c) => `correo ${c.toLowerCase()}`),
      ...(b.canales.telegram_chat_id ? [`telegram ${b.canales.telegram_chat_id}`] : []),
      ...(b.canales.portal_usuario ? [`portal ${b.canales.portal_usuario}`] : []),
      ...(b.canales.whatsapp ? [`whatsapp ${b.canales.whatsapp}`] : []),
    ];
    for (const canal of canales) {
      const dueno = duenoDeCanal.get(canal);
      if (dueno && dueno !== b.id) ctx.addIssue({ code: "custom", message: `${canal} está vinculado a ${dueno} y a ${b.id}` });
      duenoDeCanal.set(canal, b.id);
    }
  }
});

export const AprobadorSchema = z.strictObject({
  id: texto,
  nombre: texto,
  rol: texto,
  limite_usd: centavos.nullable(),
  principal: z.boolean(),
  iniciales: z.string().min(1).max(3),
}) satisfies z.ZodType<Aprobador>;

/** Exactamente un aprobador principal (§10: a él va lo que supera al resto). */
export const AprobadoresSchema = z
  .array(AprobadorSchema)
  .min(1)
  .refine((lista) => lista.filter((a) => a.principal).length === 1, { message: "debe haber exactamente un aprobador principal" });

export const DocumentoEntranteSchema = z.strictObject({
  canal: z.enum(["portal", "correo", "telegram", "whatsapp", "carga_manual"]),
  remitente: z.strictObject({ tipo: z.enum(["correo", "telegram", "whatsapp", "portal", "interno"]), valor: texto }),
  recibido_en: momento,
  asunto: z.string().optional(),
  texto_mensaje: z.string().optional(),
  adjuntos: z.array(
    z.strictObject({ nombre: texto, mime: texto, bytes_base64: z.string().optional(), ruta: z.string().optional() }),
  ),
}) satisfies z.ZodType<DocumentoEntrante>;

export const MetaDocumentoSchema = DocumentoEntranteSchema.extend({
  archivo_original: texto,
}) satisfies z.ZodType<MetaDocumento>;

function campo<T extends z.ZodType>(valor: T) {
  return z.strictObject({
    valor: valor.nullable(),
    confianza: z.number().min(0).max(1),
    fuente: z.enum(["parser", "llm", "xml", "humano"]),
  });
}

const idioma = z.enum(["es", "en", "pt"]);

export const ExtraccionSchema = z.strictObject({
  es_factura: campo(z.boolean()),
  beneficiario_nombre: campo(z.string()),
  numero: campo(z.string()),
  monto_total: campo(DineroSchema),
  subtotal: campo(DineroSchema).optional(),
  impuestos: campo(DineroSchema).optional(),
  fecha_emision: campo(fecha),
  fecha_vencimiento: campo(fecha),
  cuenta_destino_ultimos4: campo(z.string()),
  concepto: campo(z.string()),
  referencia_acuerdo: campo(z.string()).optional(),
  hito_numero: campo(z.int().positive()).optional(),
  identificacion_fiscal: campo(z.string()).optional(),
  idioma,
  texto_crudo: z.string(),
  senales_llm: z.strictObject({
    instrucciones_sospechosas: z.array(z.string()),
    sin_respuesta: z.boolean().optional(),
    lectores: z
      .array(z.strictObject({ proveedor: z.string(), estado: z.enum(["leyo", "fallo", "vacio"]), detalle: z.string().optional() }))
      .optional(),
  }),
  proveedor_llm: z.enum(["ninguno", "gemini", "groq", "anthropic"]),
}) satisfies z.ZodType<Extraccion>;

export const EvaluacionReglaSchema = z.strictObject({
  id: IdReglaSchema,
  nombre: texto,
  si_falla: z.enum(["FRENAR", "ESCALAR"]),
  resultado: z.enum(["CUMPLE", "FALLA", "NO_APLICA", "INDETERMINADO"]),
  comparacion: z.string(),
  datos: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
}) satisfies z.ZodType<EvaluacionRegla>;

const decisionAgente = z.enum(["PAGAR", "FRENAR", "ESCALAR", "RECHAZADA_NO_FACTURA"]);
const decisionHumana = z.enum(["APROBADA_HUMANO", "RECHAZADA_HUMANO"]);

export const EntradaRegistroSchema = z.strictObject({
  id: texto,
  momento,
  actor: z.discriminatedUnion("tipo", [
    z.strictObject({ tipo: z.literal("agente") }),
    z.strictObject({ tipo: z.literal("humano"), aprobador_id: texto, nombre: texto }),
  ]),
  tipo: z.enum(["DECISION_AGENTE", "DECISION_HUMANA", "CAMBIO_REGLAS", "CAMBIO_BENEFICIARIOS", "CAMBIO_EMPRESA"]),
  ref_interna: texto,
  factura_numero: z.string().nullable(),
  beneficiario: z.string().nullable(),
  canal: z.enum(["portal", "correo", "telegram", "whatsapp", "carga_manual"]),
  formato: z.enum(["pdf", "imagen", "correo", "chat", "xml"]),
  monto_original: DineroSchema.nullable(),
  monto_usd_centavos: centavos.nullable(),
  tasa_usada: z.string().nullable(),
  tasa_fecha: z.iso.date().optional(),
  decision: z.union([decisionAgente, decisionHumana]).nullable(),
  reglas_version: z.int().positive(),
  evaluaciones: z.array(EvaluacionReglaSchema),
  reglas_que_fallaron: z.array(IdReglaSchema),
  comparaciones: z.array(z.string()),
  explicacion: z.string(),
  comentario: z.string().nullable(),
  entrada_origen: z.string().nullable(),
  extraccion: ExtraccionSchema.nullable(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  moneda_base: MonedaSchema.optional(),
}) satisfies z.ZodType<EntradaRegistro>;

export const ExtraccionPlanaSchema = z.strictObject({
  es_factura: z.boolean(),
  beneficiario_nombre: z.string().nullable(),
  numero: z.string().nullable(),
  monto_total: DineroSchema.nullable(),
  subtotal: DineroSchema.optional(),
  impuestos: DineroSchema.optional(),
  fecha_emision: fecha.nullable(),
  fecha_vencimiento: fecha.nullable(),
  cuenta_destino_ultimos4: z.string().nullable(),
  concepto: z.string().nullable(),
  referencia_acuerdo: z.string().optional(),
  hito_numero: z.int().positive().optional(),
  idioma,
}) satisfies z.ZodType<ExtraccionPlana>;

/**
 * Una respuesta esperada coherente: ESCALAR siempre trae aprobador y plazo (y solo ESCALAR); un PAGAR esperado no
 * tiene reglas que fallen.
 */
export const EsperadoDocumentoSchema = z
  .strictObject({
    documento: texto,
    ref_esperada: z.string().regex(/^INT-\d{4}-\d{6}$/),
    decision: decisionAgente,
    reglas_que_fallan: z.array(IdReglaSchema),
    asignado_a: z.string().nullable(),
    responder_antes_de: momento.nullable(),
    trampa: z.array(z.enum(TRAMPAS)),
    motivo: texto,
    extraccion_esperada: ExtraccionPlanaSchema,
  })
  .refine((e) => (e.decision === "ESCALAR") === (e.asignado_a !== null && e.responder_antes_de !== null), {
    message: "asignado_a y responder_antes_de van solo (y siempre) en ESCALAR",
  })
  .refine((e) => e.decision !== "PAGAR" || e.reglas_que_fallan.length === 0, {
    message: "un PAGAR esperado no puede tener reglas que fallan",
  }) satisfies z.ZodType<EsperadoDocumento>;

export const ConfigEscenarioSchema = z.strictObject({
  id: texto,
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  ahora: momento,
  reglas_version: z.int().positive(),
  presupuesto_inicial_pagado_usd: centavos,
  descripcion: texto,
}) satisfies z.ZodType<ConfigEscenario>;
