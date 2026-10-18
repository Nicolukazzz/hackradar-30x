// Tipos compartidos del dominio. Única fuente: docs/especificacion.md §3 y §9.
// Cada tipo que se lee de disco o de HTTP tiene su esquema zod en esquemas.ts;
// tests/dominio/esquemas.test.ts comprueba en compilación que coinciden exactamente.
//
// Convenciones: montos en centavos enteros (nunca float), tasas como string decimal,
// fechas YYYY-MM-DD, momentos ISO-8601 con zona (-05:00).

export const MONEDAS = ["USD", "EUR", "COP", "BRL", "MXN", "ARS", "CLP", "PEN", "BOB", "CRC", "ZAR", "USDC"] as const;
export type Moneda = (typeof MONEDAS)[number];

/** COP 8.400.000 → { centavos: 840000000, moneda: "COP" } */
export type Dinero = { centavos: number; moneda: Moneda };

/**
 * La empresa que usa la app. En producción vive en la tabla `empresas` (#84); `data/empresa.json` es el valor
 * inicial.
 */
export type Empresa = {
  id: string;
  nombre: string;
  jurisdiccion: string;
  paises_operacion: string[];
  /** #86: la elige la empresa en Ajustes → Moneda y tasas (el dataset usa USD) */
  moneda_base: Moneda;
  zona_horaria: string;
};

export type TipoPeriodo = "mensual" | "quincenal" | "trimestral";

/** Ventana de presupuesto (R7). `id` = "2026-10" para mensual; `inicio` y `fin` inclusivos (AAAA-MM-DD). */
export type Periodo = { id: string; tipo: TipoPeriodo; inicio: string; fin: string };

/** 1 {base} = X {moneda}: con base USD, { COP: "4200.00", MXN: "18.50", USD: "1" }. La base es la moneda de la empresa (#86). */
export type TablaTasas = { periodo: string; base: Moneda; tasas: Partial<Record<Moneda, string>> };

/** Orden de evaluación del motor: R1 a R11, siempre todas y en este orden (§4.2). */
export const ID_REGLAS = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11"] as const;
export type IdRegla = (typeof ID_REGLAS)[number];

/** Solo estas reglas se pueden desactivar (§4.2). El resto está siempre activa. */
export const REGLAS_EDITABLES: readonly IdRegla[] = ["R5", "R8"];

/**
 * Una versión de las reglas de pago (§4). Cada guardado crea una versión nueva; nunca se edita una existente. La
 * versión 0 es «sin configurar» y escala todo (#106).
 */
export type Reglas = {
  version: number;
  editada_por: string;
  editada_en: string;
  limites: {
    /** R9, centavos de `moneda` */
    pago_automatico_usd: number;
    /** R6, centavos de `moneda` */
    maximo_absoluto_usd: number;
    /** R8, centavos de `moneda`, cuando el beneficiario no tiene límite propio */
    mensual_por_beneficiario_default_usd: number;
    /** R5, en puntos porcentuales: 2 = ±2 % */
    tolerancia_acordado_pct: number;
  };
  presupuesto: { periodo: TipoPeriodo; monto_usd: number; contar_escalado_como_reservado: boolean };
  duplicados: { ventana_dias: number; tolerancia_monto_pct: number; tolerancia_fecha_dias: number };
  extraccion: { confianza_minima: number };
  aprobacion: { doble_aprobacion_desde_usd: number };
  activas: Record<IdRegla, boolean>;
  /** Moneda de los límites y del presupuesto (#86): la base de la empresa. Ausente = USD. Los campos `*_usd` están en esta moneda. */
  moneda?: Moneda;
  /** Qué datos debe traer la factura para que R1 cumpla, además del monto (#109). Ausente = los de §4.3. */
  requisitos?: { obligatorios: CampoRequerible[] };
  /** Cómo se reconoce al proveedor en la factura (#108). Ausente = por nombre (como el dataset). */
  identidad?: { modo: ModoIdentidad };
};

/** nombre: nombre normalizado · nit: solo identificación fiscal · nombre_y_nit: los dos del mismo proveedor (#108). */
export type ModoIdentidad = "nombre" | "nombre_y_nit" | "nit";

/** Campos que la empresa puede exigir o no (#109). El monto no está: siempre es obligatorio. */
export const CAMPOS_REQUERIBLES = [
  "beneficiario_nombre",
  "numero",
  "fecha_emision",
  "fecha_vencimiento",
  "cuenta_destino_ultimos4",
  "concepto",
  "referencia_acuerdo",
  "identificacion_fiscal",
] as const;
export type CampoRequerible = (typeof CAMPOS_REQUERIBLES)[number];

/** Sin `requisitos` en las reglas se exige lo de §4.3 (todo salvo referencia e identificación fiscal). */
export const REQUERIDOS_POR_DEFECTO: readonly CampoRequerible[] = [
  "beneficiario_nombre",
  "numero",
  "fecha_emision",
  "fecha_vencimiento",
  "cuenta_destino_ultimos4",
  "concepto",
];

/**
 * Una línea de lo acordado con el beneficiario. R5 la elige por `codigo` (referencia de la factura) o por
 * `palabras_clave` en el concepto.
 */
export type LineaAcuerdo = {
  codigo: string;
  concepto: string;
  palabras_clave: string[];
  /** por periodo, por hito o total de la OC */
  monto: Dinero;
  hitos_total?: number;
};

export type TipoAcuerdo = "contrato_mensual" | "orden_compra" | "hitos" | "honorario" | "licencia";

/** Contrato, orden de compra, honorario o licencia con el que R5 compara la factura. */
export type Acuerdo = { tipo: TipoAcuerdo; referencia: string; descripcion: string; lineas: LineaAcuerdo[] };

export type TipoCuenta = "CLABE" | "cuenta" | "PIX" | "CBU" | "ACH";

/**
 * Proveedor o contratista de la lista permitida (R3). `canales` son los remitentes verificados (R11);
 * `cuenta.ultimos4` es lo que compara R4.
 */
export type Beneficiario = {
  id: string;
  nombre: string;
  /** NIT, RUT, RFC, CUIT, CNPJ o Tax ID tal como lo escribe el proveedor (#107); null o ausente = no registrado */
  identificacion_fiscal?: string | null;
  pais: string;
  categoria: string;
  tipo: "contratista" | "proveedor";
  cuenta: { tipo: TipoCuenta; banco: string; numero_enmascarado: string; ultimos4: string };
  acuerdo: Acuerdo | null;
  /** centavos en la moneda base; null = usar el default de Reglas */
  limite_mensual_usd: number | null;
  estado: "activo" | "inactivo";
  canales: {
    correos: string[];
    telegram_chat_id: string | null;
    portal_usuario: string | null;
    /** número de WhatsApp (#79), solo dígitos E.164 sin "+"; ausente = sin vincular */
    whatsapp?: string | null;
  };
};

/** Quien puede decidir escalados (§10). En producción se arma con los miembros del equipo que firman (#51). */
export type Aprobador = {
  id: string;
  nombre: string;
  rol: string;
  /** centavos en la moneda base; null = cualquier monto */
  limite_usd: number | null;
  principal: boolean;
  iniciales: string;
};

/** Por dónde llegó el documento. Todos entran por la misma ingesta (#11). */
export type Canal = "portal" | "correo" | "telegram" | "whatsapp" | "carga_manual";
/** Forma del documento recibido; decide qué parser lo lee. */
export type Formato = "pdf" | "imagen" | "correo" | "chat" | "xml";

/** "interno" = empleado de la empresa que reenvía una factura (R11 lo acepta solo si R3 cumple). */
export type Remitente = { tipo: "correo" | "telegram" | "whatsapp" | "portal" | "interno"; valor: string };

export type Adjunto = { nombre: string; mime: string; bytes_base64?: string; ruta?: string };

/** Lo produce cada canal; lo consume la ingesta (#11). */
export type DocumentoEntrante = {
  canal: Canal;
  remitente: Remitente;
  recibido_en: string;
  asunto?: string;
  texto_mensaje?: string;
  adjuntos: Adjunto[];
};

/** `.meta.json` del dataset: DocumentoEntrante + ruta del archivo tal como llegó (§11.1). */
export type MetaDocumento = DocumentoEntrante & { archivo_original: string };

/**
 * Documento después de la ingesta: con ref interna, huella sha256 (R2) y el beneficiario al que está vinculado el
 * remitente (R11).
 */
export type DocumentoRecibido = DocumentoEntrante & {
  /** INT-2026-000123 */
  ref_interna: string;
  sha256: string;
  formato: Formato;
  /** beneficiario al que está vinculado el remitente; null = no vinculado */
  beneficiario_remitente_id: string | null;
};

/** `humano` (#129): un aprobador corrigió el dato al decidir. */
export type FuenteCampo = "parser" | "llm" | "xml" | "humano";
/** Un dato extraído con su confianza (0 a 1) y quién lo leyó. `valor: null` = no se pudo leer. */
export type Campo<T> = { valor: T | null; confianza: number; fuente: FuenteCampo };

export type Idioma = "es" | "en" | "pt";
export type ProveedorLlm = "ninguno" | "gemini" | "groq" | "anthropic";

/** Todo lo que se leyó de un documento. Es la entrada del motor; el texto nunca decide, solo se compara. */
export type Extraccion = {
  es_factura: Campo<boolean>;
  beneficiario_nombre: Campo<string>;
  numero: Campo<string>;
  monto_total: Campo<Dinero>;
  subtotal?: Campo<Dinero>;
  impuestos?: Campo<Dinero>;
  fecha_emision: Campo<string>;
  fecha_vencimiento: Campo<string>;
  cuenta_destino_ultimos4: Campo<string>;
  concepto: Campo<string>;
  /** "OC-121", "DH-ONCALL", "CT-JPO" */
  referencia_acuerdo?: Campo<string>;
  hito_numero?: Campo<number>;
  /** NIT/RUT/RFC/CUIT/CNPJ/Tax ID de quien cobra (#108) */
  identificacion_fiscal?: Campo<string>;
  idioma: Idioma;
  /** texto completo visto en el documento (para R10 y auditoría) */
  texto_crudo: string;
  /** el LLM reporta, el código decide */
  senales_llm: {
    instrucciones_sospechosas: string[];
    /** se necesitaba el LLM y ningún proveedor respondió (#103): R1 lo dice en vez de "confianza 0 %" */
    sin_respuesta?: boolean;
    /** doble lectura: qué hizo cada lector. Si solo uno leyó, se usó su lectura sola (como sin doble lectura) */
    lectores?: { proveedor: string; estado: "leyo" | "fallo" | "vacio"; detalle?: string }[];
  };
  proveedor_llm: ProveedorLlm;
};

/** INDETERMINADO = falta un dato o no se pudo evaluar: siempre escala, aunque la regla sea de frenar (§4.2). */
export type ResultadoRegla = "CUMPLE" | "FALLA" | "NO_APLICA" | "INDETERMINADO";

/** Resultado de una regla para una factura: lo que la Traza muestra y lo que el registro guarda. */
export type EvaluacionRegla = {
  id: IdRegla;
  nombre: string;
  si_falla: "FRENAR" | "ESCALAR";
  resultado: ResultadoRegla;
  /** "2.980,00 ≤ 3.000,00 USD" (texto de §4.3) */
  comparacion: string;
  /** valores crudos usados */
  datos: Record<string, string | number | boolean | null>;
};

/** Lo que decide el motor (§5). RECHAZADA_NO_FACTURA no pasa por las reglas de pago. */
export type DecisionAgente = "PAGAR" | "FRENAR" | "ESCALAR" | "RECHAZADA_NO_FACTURA";
/** Lo que decide una persona sobre una factura escalada (§10). */
export type DecisionHumana = "APROBADA_HUMANO" | "RECHAZADA_HUMANO";

/** Salida de `evaluarFactura`: la decisión, la traza completa y la explicación en lenguaje natural (§7). */
export type ResultadoMotor = {
  decision: DecisionAgente;
  /** siempre R1..R11 en orden, aunque NO_APLICA */
  evaluaciones: EvaluacionRegla[];
  /** FALLA o INDETERMINADO */
  reglas_que_fallaron: IdRegla[];
  monto_usd_centavos: number | null;
  /** "MXN 18,50" o null si es USD */
  tasa_usada: string | null;
  /** #86: fecha de la tasa usada (la de emisión de la factura o la más cercana anterior); ausente = tasa del periodo */
  tasa_fecha?: string;
  disponible_antes_usd_centavos: number;
  /** id de aprobador si ESCALAR (§10) */
  asignado_a: string | null;
  /** ISO si ESCALAR */
  responder_antes_de: string | null;
  explicacion: string;
  /** no deciden. "El monto está a USD 20 del límite automático." */
  observaciones: string[];
};

/** Quién escribió la entrada: el agente o una persona (con su id y nombre al momento de decidir). */
export type ActorRegistro = { tipo: "agente" } | { tipo: "humano"; aprobador_id: string; nombre: string };

/** Qué registra la entrada: decisiones (agente o humana) o cambios de configuración. */
export type TipoEntrada = "DECISION_AGENTE" | "DECISION_HUMANA" | "CAMBIO_REGLAS" | "CAMBIO_BENEFICIARIOS" | "CAMBIO_EMPRESA";

/** Registro append-only (§9). Nunca se edita ni se borra. */
export type EntradaRegistro = {
  /** "REG-2026-000011" (o "REG-HIST-0001" en historial importado) */
  id: string;
  momento: string;
  actor: ActorRegistro;
  tipo: TipoEntrada;
  ref_interna: string;
  factura_numero: string | null;
  beneficiario: string | null;
  canal: Canal;
  formato: Formato;
  monto_original: Dinero | null;
  monto_usd_centavos: number | null;
  tasa_usada: string | null;
  /** #86: fecha de la tasa usada (ver ResultadoMotor) */
  tasa_fecha?: string;
  /** null en la primera de dos aprobaciones y en cambios de configuración */
  decision: DecisionAgente | DecisionHumana | null;
  reglas_version: number;
  /** vacío en decisiones humanas y en historial importado */
  evaluaciones: EvaluacionRegla[];
  reglas_que_fallaron: IdRegla[];
  /** chips de la UI: "R9 · 4.500,00 > 3.000,00" */
  comparaciones: string[];
  explicacion: string;
  /** obligatorio en DECISION_HUMANA */
  comentario: string | null;
  /** DECISION_HUMANA apunta a la DECISION_AGENTE que resuelve */
  entrada_origen: string | null;
  extraccion: Extraccion | null;
  sha256: string | null;
  /** #86: moneda base en la que está `monto_usd_centavos` (ausente = USD, como el dataset) */
  moneda_base?: Moneda;
};

// ---------------------------------------------------------------------------
// Dataset (§11): escenarios y respuesta esperada
// ---------------------------------------------------------------------------

/** Lo que devolvería un extractor perfecto (esperado.json → extraccion_esperada). Ilegible = null. */
export type ExtraccionPlana = {
  es_factura: boolean;
  beneficiario_nombre: string | null;
  numero: string | null;
  monto_total: Dinero | null;
  subtotal?: Dinero;
  impuestos?: Dinero;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  cuenta_destino_ultimos4: string | null;
  concepto: string | null;
  referencia_acuerdo?: string;
  hito_numero?: number;
  idioma: Idioma;
};

/** Casos trampa del dataset (§11.5). La evaluación reporta exactitud por cada una. */
export const TRAMPAS = [
  "duplicado", "duplicado-exacto", "beneficiario-nuevo", "no-cuadra", "sobre-limite", "sobre-maximo",
  "sin-presupuesto", "limite-mensual", "moneda-distinta", "datos-bancarios-cambiados", "ilegible",
  "no-es-factura", "suma-no-cuadra", "remitente-no-vinculado", "hito-repetido", "inyeccion", "fecha-invalida",
] as const;
export type Trampa = (typeof TRAMPAS)[number];

/** Respuesta esperada para un documento del dataset (§11.5): decisión, reglas que fallan y extracción perfecta. */
export type EsperadoDocumento = {
  /** "documentos/011-omi-3381.eml", relativo a la carpeta del escenario */
  documento: string;
  ref_esperada: string;
  decision: DecisionAgente;
  reglas_que_fallan: IdRegla[];
  asignado_a: string | null;
  responder_antes_de: string | null;
  trampa: Trampa[];
  motivo: string;
  extraccion_esperada: ExtraccionPlana;
};

/** `escenario.json`: periodo, instante `ahora` del lote y lo pagado antes del lote (§11.1). */
export type ConfigEscenario = {
  id: string;
  periodo: string;
  ahora: string;
  reglas_version: number;
  presupuesto_inicial_pagado_usd: number;
  descripcion: string;
};
