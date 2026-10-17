// Interfaz de persistencia (#17). Las rutas y servicios solo hablan con esto; hay una versión en
// memoria (demo local, tests) y habrá una de Supabase (deploy). El registro es append-only:
// la interfaz no tiene forma de editar ni borrar una entrada.

import type { DatosComunes, Escenario } from "@/dominio/cargar";
import type {
  Beneficiario,
  DecisionAgente,
  DecisionHumana,
  DocumentoRecibido,
  EntradaRegistro,
  Reglas,
  TipoEntrada,
} from "@/dominio/tipos";
import type { DocGolden } from "@/evaluacion/escenario";

export type FiltroRegistro = {
  tipo?: TipoEntrada[];
  decision?: (DecisionAgente | DecisionHumana)[];
  actor?: "agente" | "humano";
  ref_interna?: string;
};

export type ResumenVersion = { version: number; editada_por: string; editada_en: string };

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
  reglasVigentes(): Promise<Reglas>;
  reglasVersion(version: number): Promise<Reglas | null>;
  historialReglas(): Promise<ResumenVersion[]>;
  /** Guarda una versión nueva (la siguiente a la vigente) y devuelve su número. */
  guardarReglas(r: Omit<Reglas, "version">): Promise<number>;
  guardarBeneficiario(b: Beneficiario): Promise<void>;

  guardarArchivo(ref: string, archivo: ArchivoGuardado): Promise<void>;
  /** Archivo original tal como llegó (PDF, PNG, .eml, chat). */
  leerArchivo(ref: string): Promise<ArchivoGuardado | null>;
  /** Adjunto n.º `indice` del documento (el PDF dentro de un correo). */
  leerAdjunto(ref: string, indice: number): Promise<ArchivoGuardado | null>;

  siguienteRef(anio: number): Promise<string>;
  siguienteIdRegistro(anio: number): Promise<string>;
  guardarDocumento(d: DocumentoRecibido): Promise<void>;
  documento(ref: string): Promise<DocumentoRecibido | null>;
  /** Todos los documentos recibidos (ingeridos o procesados), sin orden garantizado. */
  documentos(): Promise<DocumentoRecibido[]>;

  /** SOLO agregar. No hay update ni delete. */
  agregarEntrada(e: EntradaRegistro): Promise<void>;
  /** En orden de inserción. */
  registro(filtro?: FiltroRegistro): Promise<EntradaRegistro[]>;

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
}
