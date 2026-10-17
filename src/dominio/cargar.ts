// Lectura y validación de data/ (§11). Solo servidor: usa node:fs.
// Cualquier archivo que no cumpla su esquema detiene la carga con un error que dice
// qué archivo y qué campo fallan; nunca se trabaja con datos a medias.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

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

export const DIR_DATA_POR_DEFECTO = "data";

export type DatosComunes = {
  empresa: Empresa;
  aprobadores: Aprobador[];
  beneficiarios: Beneficiario[];
  /** vigente = la versión más alta; versiones ordenadas de menor a mayor */
  reglas: { vigente: Reglas; versiones: Reglas[] };
  /** por periodo: "2026-10" → tabla */
  tasas: Record<string, TablaTasas>;
};

export type Escenario = {
  config: ConfigEscenario;
  historial: EntradaRegistro[];
  esperado: EsperadoDocumento[];
  /** en orden de llegada (recibido_en) */
  documentos: MetaDocumento[];
  /** carpeta del escenario: las rutas de los documentos son relativas a ella */
  carpeta: string;
};

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

export async function cargarDatosComunes(dir: string = DIR_DATA_POR_DEFECTO): Promise<DatosComunes> {
  const [empresa, aprobadores, beneficiarios] = await Promise.all([
    leerJson(path.join(dir, "empresa.json"), EmpresaSchema),
    leerJson(path.join(dir, "aprobadores.json"), AprobadoresSchema),
    leerJson(path.join(dir, "proveedores.json"), BeneficiariosSchema),
  ]);

  const versiones: Reglas[] = [];
  for (const nombre of await archivosJson(path.join(dir, "reglas"))) {
    const ruta = path.join(dir, "reglas", nombre);
    const reglas = await leerJson(ruta, ReglasSchema);
    if (nombre !== `v${reglas.version}.json`) throw new ErrorDatos(ruta, `el archivo debe llamarse v${reglas.version}.json`);
    versiones.push(reglas);
  }
  versiones.sort((a, b) => a.version - b.version);
  const vigente = versiones.at(-1);
  if (!vigente) throw new ErrorDatos(path.join(dir, "reglas"), "no hay ninguna versión de reglas");

  const tasas: Record<string, TablaTasas> = {};
  for (const nombre of await archivosJson(path.join(dir, "tasas"))) {
    const ruta = path.join(dir, "tasas", nombre);
    const tabla = await leerJson(ruta, TablaTasasSchema);
    if (nombre !== `${tabla.periodo}.json`) throw new ErrorDatos(ruta, `el archivo debe llamarse ${tabla.periodo}.json`);
    tasas[tabla.periodo] = tabla;
  }

  return { empresa, aprobadores, beneficiarios, reglas: { vigente, versiones }, tasas };
}

export async function cargarEscenario(id: string, dir: string = DIR_DATA_POR_DEFECTO): Promise<Escenario> {
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
  documentos.sort((a, b) => a.recibido_en.localeCompare(b.recibido_en));

  const conMeta = new Set(documentos.map((d) => d.archivo_original));
  for (const e of esperado) {
    if (!conMeta.has(e.documento)) {
      throw new ErrorDatos(path.join(carpeta, "esperado.json"), `${e.documento} no tiene .meta.json`);
    }
  }
  if (esperado.length !== documentos.length) {
    throw new ErrorDatos(carpeta, `${documentos.length} documentos pero ${esperado.length} entradas en esperado.json`);
  }
  return { config, historial, esperado, documentos, carpeta };
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
