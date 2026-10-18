// Repositorio en memoria del proceso (#17): carga data/ y el escenario elegido, y guarda todo lo
// nuevo en memoria. Sirve para la demo local, Railway con REPOSITORIO=memoria y los tests.
// Reiniciar el proceso (o POST /api/demo/reiniciar, #76) vuelve al estado inicial del escenario.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { DIR_DATA_POR_DEFECTO, type DatosComunes } from "@/dominio/cargar";
import type { Beneficiario, DocumentoRecibido, EntradaRegistro, Reglas } from "@/dominio/tipos";
import { cargarGolden, cargarSinDocumentos, type DocGolden } from "@/evaluacion/escenario";
import { mimeDeArchivo } from "@/lib/mime";
import { siguienteIdRegistro } from "@/registro/registro";

import { coincideFiltro, conVinculosTelegram, conVinculosWhatsapp, crearCola, formatoRef, leerAdjuntoDe, maxRef, versionVigente } from "./comun";
import type { ArchivoGuardado, CambiosEmpresa, EscenarioCargado, Repositorio, ResumenVersion } from "./repositorio";


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

/** Cómo arranca el repositorio en memoria. */
export type OpcionesMemoria = {
  /**
   * "pendiente" (por defecto): los documentos del escenario esperan "Procesar facturas nuevas" con sus refs reservadas.
   * "vacio": solo historial y configuración; los documentos entran por la ingesta (#11) y toman refs nuevas.
   */
  lote?: "pendiente" | "vacio";
};

/**
 * Repositorio en memoria sembrado con `data/` y el escenario `idEscenario`. Cumple el mismo contrato que el de
 * Supabase.
 */
export async function crearRepositorioMemoria(
  idEscenario: string,
  dir: string = DIR_DATA_POR_DEFECTO,
  opciones: OpcionesMemoria = {},
): Promise<Repositorio> {
  // "vacio" no lee ni hashea los documentos: van a entrar por la ingesta.
  const cargar = () => (opciones.lote === "vacio" ? cargarSinDocumentos(idEscenario, dir) : cargarGolden(idEscenario, dir));
  // Sobreviven a "Reiniciar demo" (#76), igual que en Supabase: el chat de Telegram de cada beneficiario y las
  // huellas de los enlaces ya usados.
  const vinculos = new Map<string, string>();
  const vinculosWhatsapp = new Map<string, string>();
  const huellasUsadas = new Set<string>();

  async function estadoInicial(): Promise<Estado> {
    const g = await cargar();
    const datos = structuredClone(g.datos);
    datos.beneficiarios = conVinculosWhatsapp(conVinculosTelegram(datos.beneficiarios, vinculos), vinculosWhatsapp);
    const e: Estado = {
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
      const ruta = path.join(e.carpeta, d.esperado.documento);
      e.archivos.set(d.doc.ref_interna, { ruta, nombre: path.basename(ruta), mime: mimeDeArchivo(ruta) });
    }
    return e;
  }

  let s = await estadoInicial();
  // La empresa no es parte de una corrida de demo (#84): reiniciar no deshace lo editado.
  let empresa = structuredClone(s.datos.empresa);
  const enExclusiva = crearCola();
  let reservadas = new Set<string>();
  const vigente = (): Reglas => versionVigente(s.versiones);
  const coincide = coincideFiltro;

  return {
    async datosComunes() {
      return { ...s.datos, empresa: structuredClone(empresa), reglas: { vigente: vigente(), versiones: [...s.versiones] } };
    },
    async empresa() {
      return structuredClone(empresa);
    },
    async guardarEmpresa(cambios: CambiosEmpresa) {
      empresa = { ...empresa, ...structuredClone(cambios) };
      return structuredClone(empresa);
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
    tasasVigentes() {
      return Promise.resolve(null); // tasas fijas de data/ (set de prueba)
    },
    prepararTasas() {
      return Promise.resolve();
    },
    async actualizarBeneficiario(b: Beneficiario) {
      const i = s.datos.beneficiarios.findIndex((x) => x.id === b.id);
      if (i < 0) throw new Error(`no existe el beneficiario ${b.id}`);
      s.datos.beneficiarios[i] = structuredClone(b);
    },
    async vincularTelegram(beneficiario_id, chat_id) {
      if (!s.datos.beneficiarios.some((b) => b.id === beneficiario_id)) throw new Error(`no existe el beneficiario ${beneficiario_id}`);
      for (const [b, c] of vinculos) if (b === beneficiario_id || c === chat_id) vinculos.delete(b);
      vinculos.set(beneficiario_id, chat_id);
      s.datos.beneficiarios = conVinculosTelegram(s.datos.beneficiarios, new Map([[beneficiario_id, chat_id]]));
    },
    async vincularWhatsapp(beneficiario_id, numero) {
      if (!s.datos.beneficiarios.some((b) => b.id === beneficiario_id)) throw new Error(`no existe el beneficiario ${beneficiario_id}`);
      for (const [b, n] of vinculosWhatsapp) if (b === beneficiario_id || n === numero) vinculosWhatsapp.delete(b);
      vinculosWhatsapp.set(beneficiario_id, numero);
      s.datos.beneficiarios = conVinculosWhatsapp(s.datos.beneficiarios, new Map([[beneficiario_id, numero]]));
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
      if (e.tipo === "CAMBIO_BENEFICIARIOS" && e.sha256) huellasUsadas.add(e.sha256);
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
    reiniciar() {
      return enExclusiva(async () => {
        s = await estadoInicial();
        reservadas = new Set();
      });
    },
    async tokenVinculoUsado(huella) {
      return huellasUsadas.has(huella) || s.registro.some((e) => e.tipo === "CAMBIO_BENEFICIARIOS" && e.sha256 === huella);
    },
  };
}
