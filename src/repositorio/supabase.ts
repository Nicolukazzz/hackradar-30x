// Repositorio en Supabase (#44): lo mismo que el de memoria, pero lo que cambia (registro, documentos,
// reglas guardadas, beneficiarios agregados, archivos) sobrevive a los deploys. Lo fijo (empresa, los 14
// beneficiarios base, tasas, escenario y sus documentos) sigue saliendo de data/.
// Solo servidor: usa la llave secreta (service_role). Las tablas no tienen acceso para anon ni authenticated.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { DIR_DATA_POR_DEFECTO } from "@/dominio/cargar";
import type { Beneficiario, DocumentoRecibido, EntradaRegistro, Reglas } from "@/dominio/tipos";
import { cargarGolden } from "@/evaluacion/escenario";
import { mimeDeArchivo } from "@/lib/mime";
import { siguienteIdRegistro } from "@/registro/registro";

import { coincideFiltro, crearCola, formatoRef, maxRef, versionVigente } from "./comun";
import type { ArchivoGuardado, Repositorio, ResumenVersion } from "./repositorio";

export type ConfigSupabase = { url: string; claveSecreta: string; escenario: string; dir?: string };

const BUCKET = "documentos";

/** Ruta en el bucket: `{ref}/{nombre saneado}`. El nombre ya viene generado (`{sha256}.{ext}`) desde la subida. */
const rutaArchivo = (ref: string, nombre: string) => `${ref}/${nombre.replaceAll(/[^\w.-]/g, "_")}`;

function fallar(contexto: string, error: { message: string } | null): void {
  if (error) throw new Error(`Supabase (${contexto}): ${error.message}`);
}

/** Primer arranque: siembra las versiones de reglas y el historial del escenario. Idempotente. */
async function sembrar(db: SupabaseClient, versiones: readonly Reglas[], historial: readonly EntradaRegistro[]): Promise<void> {
  const { count: hayReglas, error: e1 } = await db.from("reglas_versiones").select("version", { count: "exact", head: true });
  fallar("contar reglas", e1);
  if (!hayReglas) {
    const { error } = await db.from("reglas_versiones").upsert(versiones.map((r) => ({ version: r.version, reglas: r })), { onConflict: "version", ignoreDuplicates: true });
    fallar("sembrar reglas", error);
  }
  const { count: hayRegistro, error: e2 } = await db.from("registro").select("orden", { count: "exact", head: true });
  fallar("contar registro", e2);
  if (!hayRegistro && historial.length > 0) {
    const { error } = await db.from("registro").insert(historial.map(fila));
    fallar("sembrar historial", error);
  }
}

const fila = (e: EntradaRegistro) => ({ id: e.id, ref_interna: e.ref_interna, tipo: e.tipo, decision: e.decision, entrada: e });

export async function crearRepositorioSupabase(config: ConfigSupabase): Promise<Repositorio> {
  const db = createClient(config.url, config.claveSecreta, { auth: { persistSession: false, autoRefreshToken: false } });
  const g = await cargarGolden(config.escenario, config.dir ?? DIR_DATA_POR_DEFECTO);
  const escenario = {
    config: g.escenario.config,
    esperado: g.escenario.esperado,
    entradas_importadas: g.escenario.historial.length,
    carpeta: g.escenario.carpeta,
  };
  const refsGolden = new Set(g.docs.map((d) => d.doc.ref_interna));
  const archivoGolden = new Map(g.docs.map((d) => [d.doc.ref_interna, path.join(g.escenario.carpeta, d.esperado.documento)]));
  await sembrar(db, g.datos.reglas.versiones, g.escenario.historial);

  const enExclusiva = crearCola();

  async function versiones(): Promise<Reglas[]> {
    const { data, error } = await db.from("reglas_versiones").select("reglas").order("version");
    fallar("leer reglas", error);
    return (data ?? []).map((r) => r.reglas as Reglas);
  }

  async function agregados(): Promise<Beneficiario[]> {
    const { data, error } = await db.from("beneficiarios_agregados").select("beneficiario").order("creado_en");
    fallar("leer beneficiarios", error);
    return (data ?? []).map((r) => r.beneficiario as Beneficiario);
  }

  async function registro(): Promise<EntradaRegistro[]> {
    // Todo en orden de inserción. Para una demo son cientos de filas; con más, paginar o filtrar en SQL.
    const { data, error } = await db.from("registro").select("entrada").order("orden");
    fallar("leer registro", error);
    return (data ?? []).map((r) => r.entrada as EntradaRegistro);
  }

  async function filaDocumento(ref: string) {
    const { data, error } = await db.from("documentos").select("documento, archivo_ruta, archivo_nombre, archivo_mime").eq("ref_interna", ref).maybeSingle();
    fallar("leer documento", error);
    return data;
  }

  async function documentos(): Promise<DocumentoRecibido[]> {
    const { data, error } = await db.from("documentos").select("documento").not("documento", "is", null);
    fallar("leer documentos", error);
    return (data ?? []).map((r) => r.documento as DocumentoRecibido);
  }

  return {
    async datosComunes() {
      const [vs, extra] = await Promise.all([versiones(), agregados()]);
      return { ...g.datos, beneficiarios: [...g.datos.beneficiarios, ...extra], reglas: { vigente: versionVigente(vs), versiones: vs } };
    },
    async reglasVigentes() {
      return versionVigente(await versiones());
    },
    async reglasVersion(version) {
      const { data, error } = await db.from("reglas_versiones").select("reglas").eq("version", version).maybeSingle();
      fallar("leer versión", error);
      return (data?.reglas as Reglas | undefined) ?? null;
    },
    async historialReglas(): Promise<ResumenVersion[]> {
      return (await versiones()).map(({ version, editada_por, editada_en }) => ({ version, editada_por, editada_en })).sort((a, b) => b.version - a.version);
    },
    async guardarReglas(r) {
      const version = versionVigente(await versiones()).version + 1;
      // La clave primaria impide que dos guardados simultáneos tomen el mismo número.
      const { error } = await db.from("reglas_versiones").insert({ version, reglas: { ...r, version } });
      fallar("guardar reglas", error);
      return version;
    },
    async guardarBeneficiario(b) {
      if (g.datos.beneficiarios.some((x) => x.id === b.id)) throw new Error(`el beneficiario ${b.id} ya existe`);
      const { error } = await db.from("beneficiarios_agregados").insert({ id: b.id, beneficiario: b });
      if (error?.code === "23505") throw new Error(`el beneficiario ${b.id} ya existe`);
      fallar("guardar beneficiario", error);
    },
    async guardarArchivo(ref, archivo) {
      const ruta = rutaArchivo(ref, archivo.nombre);
      const subida = await db.storage.from(BUCKET).upload(ruta, archivo.bytes, { contentType: archivo.mime, upsert: true });
      fallar("subir archivo", subida.error);
      const { error } = await db
        .from("documentos")
        .upsert({ ref_interna: ref, archivo_ruta: ruta, archivo_nombre: archivo.nombre, archivo_mime: archivo.mime }, { onConflict: "ref_interna" });
      fallar("registrar archivo", error);
    },
    async leerArchivo(ref) {
      const f = await filaDocumento(ref);
      if (f?.archivo_ruta) {
        const { data, error } = await db.storage.from(BUCKET).download(f.archivo_ruta);
        fallar("bajar archivo", error);
        if (!data) return null;
        return { nombre: f.archivo_nombre ?? path.basename(f.archivo_ruta), mime: f.archivo_mime ?? "application/octet-stream", bytes: Buffer.from(await data.arrayBuffer()) };
      }
      // Documentos del escenario: el archivo está en data/ (viaja con el deploy).
      const ruta = archivoGolden.get(ref);
      if (!ruta) return null;
      return { nombre: path.basename(ruta), mime: mimeDeArchivo(ruta), bytes: await readFile(/*turbopackIgnore: true*/ ruta) };
    },
    async leerAdjunto(ref, indice): Promise<ArchivoGuardado | null> {
      const doc = (await filaDocumento(ref))?.documento as DocumentoRecibido | null | undefined;
      const adj = doc?.adjuntos[indice];
      if (!adj) return null;
      if (adj.bytes_base64 !== undefined) return { nombre: adj.nombre, mime: adj.mime, bytes: Buffer.from(adj.bytes_base64, "base64") };
      if (adj.ruta === undefined) return null;
      const base = path.resolve(/*turbopackIgnore: true*/ g.escenario.carpeta);
      const ruta = path.resolve(/*turbopackIgnore: true*/ base, adj.ruta);
      if (!ruta.startsWith(base + path.sep)) return null; // nunca fuera de la carpeta del escenario
      return { nombre: adj.nombre, mime: adj.mime, bytes: await readFile(/*turbopackIgnore: true*/ ruta) };
    },
    async siguienteRef(anio) {
      // Consecutivo atómico en la base. El mínimo deja libres las refs reservadas por el escenario y las del historial.
      const minimo = maxRef([...refsGolden, ...g.escenario.historial.map((e) => e.ref_interna)], anio) + 1;
      const { data, error } = await db.rpc("siguiente_secuencia", { p_nombre: `INT-${anio}`, p_minimo: minimo });
      fallar("siguiente ref", error);
      return formatoRef(anio, Number(data));
    },
    async siguienteIdRegistro(anio) {
      return siguienteIdRegistro(await registro(), String(anio));
    },
    async guardarDocumento(d) {
      const { error } = await db.from("documentos").upsert({ ref_interna: d.ref_interna, documento: d }, { onConflict: "ref_interna" });
      fallar("guardar documento", error);
    },
    async documento(ref) {
      return ((await filaDocumento(ref))?.documento as DocumentoRecibido | null | undefined) ?? null;
    },
    documentos,
    async agregarEntrada(e) {
      const { error } = await db.from("registro").insert(fila(e));
      if (error?.code === "23505") throw new Error(`la entrada ${e.id} ya existe: el registro no se sobrescribe`);
      fallar("agregar entrada", error);
    },
    async registro(filtro) {
      return (await registro()).filter((e) => coincideFiltro(e, filtro));
    },
    async escenario() {
      return escenario;
    },
    // Exclusividad dentro del proceso (un solo servicio web en Railway). Con varias réplicas haría falta un candado en la base.
    enExclusiva,
    async documentosEscenario() {
      return [...g.docs];
    },
    async pendientes() {
      const guardados = new Set((await documentos()).map((d) => d.ref_interna));
      return g.docs.filter((d) => !guardados.has(d.doc.ref_interna));
    },
  };
}
