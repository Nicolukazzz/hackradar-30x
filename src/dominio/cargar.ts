// Lectura y validación de data/ (§11). Solo servidor: usa node:fs.
// Cualquier archivo que no cumpla su esquema detiene la carga con un error que dice
// qué archivo y qué campo fallan; nunca se trabaja con datos a medias.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { instante } from "./reloj";
import {
  AprobadoresSchema,
  BeneficiariosSchema,
  ConfigEscenarioSchema,
  EmpresaSchema,
  EntradaRegistroSchema,
  EsperadoDocumentoSchema,
  MetaDocumentoSchema,
  ReglasSchema,
  TablaTasasSchema,
} from "./esquemas";
import type {
  Aprobador,
  Beneficiario,
  ConfigEscenario,
  Empresa,
  EntradaRegistro,
  EsperadoDocumento,
  MetaDocumento,
  Reglas,
  TablaTasas,
} from "./tipos";

/** Carpeta del dataset, relativa a la raíz del proyecto. */
export const DIR_DATA_POR_DEFECTO = "data";

/**
 * Configuración compartida por todos los escenarios: empresa, aprobadores, lista permitida, versiones de reglas y
 * tasas. En producción la arma el repositorio desde la base.
 */
export type DatosComunes = {
  empresa: Empresa;
  aprobadores: Aprobador[];
  beneficiarios: Beneficiario[];
  /** vigente = la versión más alta; versiones ordenadas de menor a mayor */
  reglas: { vigente: Reglas; versiones: Reglas[] };
  /** por periodo: "2026-10" → tabla */
  tasas: Record<string, TablaTasas>;
  /**
   * #86: fotos diarias por fecha ("2026-10-10" → tabla). Si existen, el motor convierte con la de la fecha de emisión
   * de la factura (o la más cercana anterior). Ausente (dataset): la tabla del periodo.
   */
  tasas_diarias?: Record<string, TablaTasas>;
};

/**
 * Un escenario del dataset listo para correr: estado inicial, documentos en orden de llegada y respuesta esperada.
 */
export type Escenario = {
  config: ConfigEscenario;
  historial: EntradaRegistro[];
  esperado: EsperadoDocumento[];
  /** en orden de llegada (recibido_en) */
  documentos: MetaDocumento[];
  /** carpeta del escenario: las rutas de los documentos son relativas a ella */
  carpeta: string;
};

/** Archivo de `data/` inválido. El mensaje empieza por la ruta para saber qué corregir. */
export class ErrorDatos extends Error {
  constructor(ruta: string, detalle: string) {
    super(`${ruta}: ${detalle}`);
    this.name = "ErrorDatos";
  }
}

async function leerJson<T>(ruta: string, esquema: z.ZodType<T>): Promise<T> {
  let crudo: unknown;
  try {
    crudo = JSON.parse(await readFile(ruta, "utf8"));
  } catch (e) {
    throw new ErrorDatos(ruta, e instanceof Error ? e.message : String(e));
  }
  const resultado = esquema.safeParse(crudo);
  if (!resultado.success) throw new ErrorDatos(ruta, z.prettifyError(resultado.error));
  return resultado.data;
}

async function archivosJson(dir: string): Promise<string[]> {
  return (await readdir(dir)).filter((n) => n.endsWith(".json")).sort();
}

/**
 * Lee y valida los datos comunes de `dir`. Exige `reglas/vN.json` y `tasas/AAAA-MM.json` con nombre igual a su
 * contenido. Lanza `ErrorDatos` ante el primer archivo inválido.
 */
export async function cargarDatosComunes(dir: string = DIR_DATA_POR_DEFECTO): Promise<DatosComunes> {
  const [empresa, aprobadores, beneficiarios] = await Promise.all([
    leerJson(path.join(dir, "empresa.json"), EmpresaSchema),
    leerJson(path.join(dir, "aprobadores.json"), AprobadoresSchema),
    leerJson(path.join(dir, "proveedores.json"), BeneficiariosSchema),
  ]);

  const versiones = await Promise.all(
    (await archivosJson(path.join(dir, "reglas"))).map(async (nombre) => {
      const ruta = path.join(dir, "reglas", nombre);
      const reglas = await leerJson(ruta, ReglasSchema);
      if (nombre !== `v${reglas.version}.json`) throw new ErrorDatos(ruta, `el archivo debe llamarse v${reglas.version}.json`);
      return reglas;
    }),
  );
  versiones.sort((a, b) => a.version - b.version);
  const vigente = versiones.at(-1);
  if (!vigente) throw new ErrorDatos(path.join(dir, "reglas"), "no hay ninguna versión de reglas");

  const tablas = await Promise.all(
    (await archivosJson(path.join(dir, "tasas"))).map(async (nombre) => {
      const ruta = path.join(dir, "tasas", nombre);
      const tabla = await leerJson(ruta, TablaTasasSchema);
      if (nombre !== `${tabla.periodo}.json`) throw new ErrorDatos(ruta, `el archivo debe llamarse ${tabla.periodo}.json`);
      return tabla;
    }),
  );
  const tasas: Record<string, TablaTasas> = Object.fromEntries(tablas.map((t) => [t.periodo, t]));

  return { empresa, aprobadores, beneficiarios, reglas: { vigente, versiones }, tasas };
}

/** Ids de escenario: minúsculas, dígitos y guiones. Evita salir de data/escenarios con "../". */
const ID_ESCENARIO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Lee y valida `data/escenarios/<id>`: config, historial, esperado y documentos ordenados por `recibido_en`.
 * Comprueba que cada documento tenga exactamente una respuesta esperada.
 */
export async function cargarEscenario(id: string, dir: string = DIR_DATA_POR_DEFECTO): Promise<Escenario> {
  if (!ID_ESCENARIO.test(id)) throw new Error(`id de escenario inválido: "${id}"`);
  const carpeta = path.join(dir, "escenarios", id);
  const [config, historial, esperado] = await Promise.all([
    leerJson(path.join(carpeta, "escenario.json"), ConfigEscenarioSchema),
    leerJson(path.join(carpeta, "historial.json"), z.array(EntradaRegistroSchema)),
    leerJson(path.join(carpeta, "esperado.json"), z.array(EsperadoDocumentoSchema)),
  ]);
  if (config.id !== id) throw new ErrorDatos(path.join(carpeta, "escenario.json"), `id "${config.id}" no coincide con la carpeta "${id}"`);

  const carpetaDocs = path.join(carpeta, "documentos");
  const metas = (await readdir(carpetaDocs)).filter((n) => n.endsWith(".meta.json")).sort();
  const documentos = await Promise.all(metas.map((n) => leerJson(path.join(carpetaDocs, n), MetaDocumentoSchema)));
  // Orden de llegada por instante real (no por texto: "…14:15Z" es antes que "…09:20-05:00").
  documentos.sort(
    (a, b) => instante(a.recibido_en) - instante(b.recibido_en) || a.archivo_original.localeCompare(b.archivo_original),
  );
  validarCorrespondencia(path.join(carpeta, "esperado.json"), documentos, esperado);
  return { config, historial, esperado, documentos, carpeta };
}

/** Cada documento tiene exactamente una entrada en esperado.json y viceversa. */
function validarCorrespondencia(ruta: string, documentos: MetaDocumento[], esperado: EsperadoDocumento[]): void {
  const documentosPorArchivo = new Set(documentos.map((d) => d.archivo_original));
  const vistos = new Set<string>();
  for (const e of esperado) {
    if (vistos.has(e.documento)) throw new ErrorDatos(ruta, `${e.documento} aparece más de una vez`);
    vistos.add(e.documento);
    if (!documentosPorArchivo.has(e.documento)) throw new ErrorDatos(ruta, `${e.documento} no tiene .meta.json`);
  }
  for (const archivo of documentosPorArchivo) {
    if (!vistos.has(archivo)) throw new ErrorDatos(ruta, `${archivo} no tiene entrada en esperado.json`);
  }
}

/** Reglas de una versión concreta (la del escenario, por ejemplo). */
export function reglasVersion(datos: DatosComunes, version: number): Reglas {
  const reglas = datos.reglas.versiones.find((r) => r.version === version);
  if (!reglas) throw new Error(`no existe la versión ${version} de reglas`);
  return reglas;
}

/** Tabla de tasas de un periodo ("2026-10"). */
export function tasasDelPeriodo(datos: DatosComunes, periodo: string): TablaTasas {
  const tabla = datos.tasas[periodo];
  if (!tabla) throw new Error(`no hay tabla de tasas para ${periodo}`);
  return tabla;
}
