// Interfaz de persistencia (#17). Las rutas y servicios solo hablan con esto. Dos implementaciones con el mismo
// contrato (tests/repositorio/contrato.ts): memoria (demo local, tests) y Supabase (producción, #44). El registro es
// append-only: la interfaz no tiene forma de editar ni borrar una entrada.

import type { DatosComunes, Escenario } from "@/dominio/cargar";
import type {
  Beneficiario,
  DecisionAgente,
  Empresa,
  DecisionHumana,
  DocumentoRecibido,
  EntradaRegistro,
  Reglas,
  TipoEntrada,
} from "@/dominio/tipos";
import type { DocGolden } from "@/evaluacion/escenario";
import type { TasasVigentes } from "@/tasas/tipos";

/** Criterios para leer el registro; todos opcionales y combinados con «y». */
export type FiltroRegistro = {
  tipo?: TipoEntrada[];
  decision?: (DecisionAgente | DecisionHumana)[];
  actor?: "agente" | "humano";
  ref_interna?: string;
};

/** Lo que se edita en Ajustes → Datos de la empresa (#84). */
export type CambiosEmpresa = Pick<Empresa, "nombre" | "jurisdiccion" | "paises_operacion"> & Partial<Pick<Empresa, "moneda_base">>;

/** Una versión de reglas en el historial: número, quién y cuándo. */
export type ResumenVersion = { version: number; editada_por: string; editada_en: string };

/** Archivo original tal como llegó. */
export type ArchivoGuardado = { nombre: string; mime: string; bytes: Buffer };

/** Escenario cargado (demo): su configuración, el esperado y los documentos que aún no se procesaron. */
export type EscenarioCargado = {
  config: Escenario["config"];
  esperado: Escenario["esperado"];
  /** cuántas entradas del registro vienen del historial importado (no son del lote) */
  entradas_importadas: number;
  /** carpeta del escenario: las rutas de los adjuntos son relativas a ella */
  carpeta: string;
};

export interface Repositorio {
  datosComunes(): Promise<DatosComunes>;
  /**
   * Datos de la empresa (#84): en Supabase, la fila de `empresas`; en memoria, `data/empresa.json` más lo editado.
   * No es parte de una corrida de demo: "Reiniciar demo" no la cambia. `datosComunes().empresa` es lo mismo.
   */
  empresa(): Promise<Empresa>;
  /** Guarda nombre, jurisdicción y países (el id, la moneda y la zona horaria no cambian aquí). */
  guardarEmpresa(cambios: CambiosEmpresa): Promise<Empresa>;
  /** La versión más alta guardada; sin ninguna, la versión 0 «sin configurar» (#106). */
  reglasVigentes(): Promise<Reglas>;
  reglasVersion(version: number): Promise<Reglas | null>;
  historialReglas(): Promise<ResumenVersion[]>;
  /** Guarda una versión nueva (la siguiente a la vigente) y devuelve su número. */
  guardarReglas(r: Omit<Reglas, "version">): Promise<number>;
  /** Agrega un beneficiario a la lista permitida (alta en Proveedores o «confiar siempre»). */
  guardarBeneficiario(b: Beneficiario): Promise<void>;
  /**
   * Tasas del día que usa el agente (#86) y de dónde salieron. null = tasas fijas del set de prueba (memoria, demo).
   * Producción: la foto del día de `tasas_dia`, o la última si la fuente falla.
   */
  tasasVigentes(): Promise<TasasVigentes | null>;
  /**
   * #86: que exista la foto de tasas de `fecha` (emisión de la factura) antes de decidir. No lanza: si la fuente falla,
   * el motor usa la foto anterior más cercana. En memoria no hace nada (tasas fijas del set de prueba).
   */
  prepararTasas(fecha: string): Promise<void>;
  /** Reemplaza un beneficiario creado en la app (#107). Lanza si no existe o es uno base del escenario de prueba. */
  actualizarBeneficiario(b: Beneficiario): Promise<void>;
  /**
   * Vincula un chat de Telegram a un beneficiario (base o agregado) (#13). Un chat pertenece a un solo
   * beneficiario y un beneficiario tiene un solo chat: el vínculo anterior de cualquiera de los dos se reemplaza.
   * Lanza si el beneficiario no existe.
   */
  vincularTelegram(beneficiario_id: string, chat_id: string): Promise<void>;
  /** Igual que `vincularTelegram` para un número de WhatsApp (#79): dígitos E.164 sin "+". */
  vincularWhatsapp(beneficiario_id: string, numero: string): Promise<void>;

  guardarArchivo(ref: string, archivo: ArchivoGuardado): Promise<void>;
  /** Archivo original tal como llegó (PDF, PNG, .eml, chat). */
  leerArchivo(ref: string): Promise<ArchivoGuardado | null>;
  /** Adjunto n.º `indice` del documento (el PDF dentro de un correo). */
  leerAdjunto(ref: string, indice: number): Promise<ArchivoGuardado | null>;

  /** Reserva la siguiente ref `INT-AAAA-NNNNNN`. Una ref reservada nunca se reutiliza, aunque el documento falle. */
  siguienteRef(anio: number): Promise<string>;
  /** Siguiente id consecutivo `REG-AAAA-NNNNNN` del registro. */
  siguienteIdRegistro(anio: number): Promise<string>;
  guardarDocumento(d: DocumentoRecibido): Promise<void>;
  documento(ref: string): Promise<DocumentoRecibido | null>;
  /** Todos los documentos recibidos (ingeridos o procesados), sin orden garantizado. */
  documentos(): Promise<DocumentoRecibido[]>;

  /** SOLO agregar. No hay update ni delete. */
  agregarEntrada(e: EntradaRegistro): Promise<void>;
  /** En orden de inserción. */
  registro(filtro?: FiltroRegistro): Promise<EntradaRegistro[]>;

  /** Escenario cargado en modo demo; null en producción (sin datos de ejemplo). */
  escenario(): Promise<EscenarioCargado | null>;
  /**
   * Ejecuta `fn` en exclusiva frente a otras escrituras (leer → validar → agregar sin carreras:
   * dos "Procesar" o dos decisiones sobre la misma factura nunca se pisan).
   */
  enExclusiva<T>(fn: () => Promise<T>): Promise<T>;
  /** Todos los documentos del escenario en modo golden (con su extracción esperada): para simular reglas. */
  documentosEscenario(): Promise<DocGolden[]>;
  /** Los del escenario que todavía no se procesaron. */
  pendientes(): Promise<DocGolden[]>;

  /**
   * Demo (#76): empieza una corrida nueva, como recién sembrada desde el escenario (historial, reglas, sin
   * documentos ni beneficiarios agregados, refs desde 000001). Nada se borra: en Supabase las corridas
   * anteriores quedan en las tablas. Los vínculos de Telegram se conservan.
   */
  reiniciar(iniciada_por: string): Promise<void>;
  /** ¿Ya se usó el enlace de Telegram con esta huella? (#13). Mira todas las corridas: un enlace usado nunca vuelve a valer. */
  tokenVinculoUsado(huella: string): Promise<boolean>;
}
