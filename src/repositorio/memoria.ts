// Repositorio en memoria del proceso (#17): carga data/ y el escenario elegido, y guarda todo lo
// nuevo en memoria. Sirve para la demo local, Railway con REPOSITORIO=memoria y los tests.
// Reiniciar el proceso (o POST /api/demo/reiniciar) vuelve al estado inicial del escenario.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { DIR_DATA_POR_DEFECTO, type DatosComunes } from "@/dominio/cargar";
import type { Beneficiario, DocumentoRecibido, EntradaRegistro, Reglas } from "@/dominio/tipos";
import { cargarGolden, cargarSinDocumentos, type DocGolden } from "@/evaluacion/escenario";
import { mimeDeArchivo } from "@/lib/mime";
import { siguienteIdRegistro } from "@/registro/registro";

import { coincideFiltro, conVinculosTelegram, crearCola, formatoRef, leerAdjuntoDe, maxRef, versionVigente } from "./comun";
import type { ArchivoGuardado, EscenarioCargado, Repositorio, ResumenVersion } from "./repositorio";


type Estado = {
  datos: DatosComunes;
  versiones: Reglas[];
  registro: EntradaRegistro[];
  documentos: Map<string, DocumentoRecibido>;
  archivos: Map<string, ArchivoGuardado | { ruta: string; nombre: string; mime: string }>;
  escenario: EscenarioCargado;
  golden: DocGolden[];
  carpeta: string;
};

export type OpcionesMemoria = {
  /**
   * "pendiente" (por defecto): los documentos del escenario esperan "Procesar facturas nuevas" con sus refs reservadas.
   * "vacio": solo historial y configuración; los documentos entran por la ingesta (#11) y toman refs nuevas.
   */
  lote?: "pendiente" | "vacio";
};

export async function crearRepositorioMemoria(
  idEscenario: string,
  dir: string = DIR_DATA_POR_DEFECTO,
  opciones: OpcionesMemoria = {},
): Promise<Repositorio> {
  // "vacio" no lee ni hashea los documentos: van a entrar por la ingesta.
  const g = opciones.lote === "vacio" ? await cargarSinDocumentos(idEscenario, dir) : await cargarGolden(idEscenario, dir);
  const datos = structuredClone(g.datos);
  const s: Estado = {
    datos,
    versiones: [...datos.reglas.versiones],
    registro: [...g.escenario.historial],
    documentos: new Map(),
    archivos: new Map(),
    escenario: {
      config: g.escenario.config,
      esperado: g.escenario.esperado,
      entradas_importadas: g.escenario.historial.length,
      carpeta: g.escenario.carpeta,
    },
    golden: g.docs,
    carpeta: g.escenario.carpeta,
  };
  // Archivo original de cada documento del escenario (lo que muestra el visor de la traza).
  for (const d of g.docs) {
    const ruta = path.join(s.carpeta, d.esperado.documento);
    s.archivos.set(d.doc.ref_interna, { ruta, nombre: path.basename(ruta), mime: mimeDeArchivo(ruta) });
  }
  const enExclusiva = crearCola();
  const reservadas = new Set<string>();
  const vigente = (): Reglas => versionVigente(s.versiones);
  const coincide = coincideFiltro;

  return {
    async datosComunes() {
      return { ...s.datos, reglas: { vigente: vigente(), versiones: [...s.versiones] } };
    },
    async reglasVigentes() {
      return vigente();
    },
    async reglasVersion(version) {
      return s.versiones.find((r) => r.version === version) ?? null;
    },
    async historialReglas(): Promise<ResumenVersion[]> {
      return s.versiones.map(({ version, editada_por, editada_en }) => ({ version, editada_por, editada_en })).sort((a, b) => b.version - a.version);
    },
    async guardarReglas(r) {
      const version = vigente().version + 1;
      s.versiones.push({ ...structuredClone(r), version });
      return version;
    },
    async guardarBeneficiario(b: Beneficiario) {
      const i = s.datos.beneficiarios.findIndex((x) => x.id === b.id);
      if (i >= 0) throw new Error(`el beneficiario ${b.id} ya existe`);
      s.datos.beneficiarios.push(structuredClone(b));
    },
    async vincularTelegram(beneficiario_id, chat_id) {
      if (!s.datos.beneficiarios.some((b) => b.id === beneficiario_id)) throw new Error(`no existe el beneficiario ${beneficiario_id}`);
      s.datos.beneficiarios = conVinculosTelegram(s.datos.beneficiarios, new Map([[beneficiario_id, chat_id]]));
    },
    async guardarArchivo(ref, archivo) {
      s.archivos.set(ref, { ...archivo, bytes: Buffer.from(archivo.bytes) });
    },
    async leerArchivo(ref) {
      const a = s.archivos.get(ref);
      if (!a) return null;
      if ("bytes" in a) return a;
      return { nombre: a.nombre, mime: a.mime, bytes: await readFile(/*turbopackIgnore: true*/ a.ruta) };
    },
    async leerAdjunto(ref, indice) {
      return leerAdjuntoDe(s.documentos.get(ref), indice, s.carpeta);
    },
    async siguienteRef(anio) {
      // Las refs del escenario ya están reservadas para sus documentos (aunque aún no se procesen), y cada
      // ref entregada queda reservada aunque no se llegue a guardar: nunca se reutiliza (igual que Supabase).
      const usadas = [...reservadas, ...s.documentos.keys(), ...s.golden.map((d) => d.doc.ref_interna), ...s.registro.map((e) => e.ref_interna)];
      const ref = formatoRef(anio, maxRef(usadas, anio) + 1);
      reservadas.add(ref);
      return ref;
    },
    async siguienteIdRegistro(anio) {
      return siguienteIdRegistro(s.registro, String(anio));
    },
    async guardarDocumento(d) {
      s.documentos.set(d.ref_interna, structuredClone(d));
    },
    async documento(ref) {
      return s.documentos.get(ref) ?? null;
    },
    async documentos() {
      return [...s.documentos.values()].map((d) => structuredClone(d));
    },
    async agregarEntrada(e) {
      if (s.registro.some((x) => x.id === e.id)) throw new Error(`la entrada ${e.id} ya existe: el registro no se sobrescribe`);
      s.registro.push(structuredClone(e));
    },
    async registro(filtro) {
      return s.registro.filter((e) => coincide(e, filtro)).map((e) => structuredClone(e));
    },
    async escenario() {
      return s.escenario;
    },
    async documentosEscenario() {
      return [...s.golden];
    },
    enExclusiva,
    async pendientes() {
      return s.golden.filter((d) => !s.documentos.has(d.doc.ref_interna));
    },
  };
}
