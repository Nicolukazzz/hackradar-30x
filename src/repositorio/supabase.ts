// Repositorio en Supabase (#44): lo mismo que el de memoria, pero lo que cambia (registro, documentos,
// reglas guardadas, beneficiarios agregados, archivos, datos de la empresa #84) sobrevive a los deploys. Lo fijo
// (los 14 beneficiarios base, tasas, escenario y sus documentos) sigue saliendo de data/.
// Corridas de demo (#76): cada tabla de la demo tiene corrida_id (por defecto, la vigente, resuelta en la base).
// Se lee de las vistas `*_vigente(s)` y se escribe en las tablas; "Reiniciar demo" abre una corrida nueva y las
// anteriores quedan intactas.
// Solo servidor: usa la llave secreta (service_role). Las tablas no tienen acceso para anon ni authenticated.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { DIR_DATA_POR_DEFECTO } from "@/dominio/cargar";
import { EmpresaSchema } from "@/dominio/esquemas";
import type { Beneficiario, DocumentoRecibido, Empresa, EntradaRegistro, Reglas } from "@/dominio/tipos";
import { cargarGolden } from "@/evaluacion/escenario";
import { mimeDeArchivo } from "@/lib/mime";
import { siguienteIdRegistro } from "@/registro/registro";

import { coincideFiltro, conVinculosTelegram, crearCola, formatoRef, leerAdjuntoDe, maxRef, versionVigente } from "./comun";
import type { CambiosEmpresa, Repositorio, ResumenVersion } from "./repositorio";

export type ConfigSupabase = { url: string; claveSecreta: string; escenario: string; dir?: string };

const BUCKET = "documentos";

/**
 * Ruta en el bucket: `c{corrida}/{ref}/{nombre saneado}` (las refs se repiten entre corridas). El nombre ya viene
 * generado (`{sha256}.{ext}`) desde la subida.
 */
const rutaArchivo = (corrida: number, ref: string, nombre: string) => `c${corrida}/${ref}/${nombre.replaceAll(/[^\w.-]/g, "_")}`;

function fallar(contexto: string, error: { message: string } | null): void {
  if (error) throw new Error(`Supabase (${contexto}): ${error.message}`);
}

/**
 * Siembra las versiones de reglas y el historial del escenario en la corrida vigente. Idempotente y sin carreras:
 * ON CONFLICT DO NOTHING, así dos instancias que arrancan a la vez no chocan, y si cambia ESCENARIO se agrega el
 * historial que falte.
 */
async function sembrar(db: SupabaseClient, versiones: readonly Reglas[], historial: readonly EntradaRegistro[]): Promise<void> {
  const r = await db.from("reglas_versiones").upsert(versiones.map((v) => ({ version: v.version, reglas: v })), { onConflict: "corrida_id,version", ignoreDuplicates: true });
  fallar("sembrar reglas", r.error);
  if (historial.length === 0) return;
  const h = await db.from("registro").upsert(historial.map(fila), { onConflict: "corrida_id,id", ignoreDuplicates: true });
  fallar("sembrar historial", h.error);
}

/** PostgREST corta cada respuesta en 1000 filas: se pide de a páginas hasta traer todo. Nunca un historial a medias. */
const PAGINA = 1000;
async function todas<T>(pedir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, contexto: string): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await pedir(desde, desde + PAGINA - 1);
    fallar(contexto, error);
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return filas;
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
    const { data, error } = await db.from("reglas_vigentes").select("reglas").order("version");
    fallar("leer reglas", error);
    return (data ?? []).map((r) => r.reglas as Reglas);
  }

  async function agregados(): Promise<Beneficiario[]> {
    const { data, error } = await db.from("beneficiarios_agregados_vigentes").select("beneficiario").order("creado_en");
    fallar("leer beneficiarios", error);
    return (data ?? []).map((r) => r.beneficiario as Beneficiario);
  }

  /** beneficiario_id → chat_id (#13). */
  async function vinculosTelegram(): Promise<Map<string, string>> {
    const { data, error } = await db.from("vinculos_telegram").select("beneficiario_id, chat_id");
    fallar("leer vínculos de Telegram", error);
    return new Map((data ?? []).map((r) => [r.beneficiario_id as string, r.chat_id as string]));
  }

  async function beneficiarios(): Promise<Beneficiario[]> {
    const [extra, telegram] = await Promise.all([agregados(), vinculosTelegram()]);
    return conVinculosTelegram([...g.datos.beneficiarios, ...extra], telegram);
  }

  async function registro(): Promise<EntradaRegistro[]> {
    const filas = await todas<{ entrada: unknown }>((a, b) => db.from("registro_vigente").select("entrada").order("orden").range(a, b), "leer registro");
    return filas.map((r) => r.entrada as EntradaRegistro);
  }

  async function filaDocumento(ref: string) {
    const { data, error } = await db.from("documentos_vigentes").select("documento, archivo_ruta, archivo_nombre, archivo_mime").eq("ref_interna", ref).maybeSingle();
    fallar("leer documento", error);
    return data;
  }

  async function documentos(): Promise<DocumentoRecibido[]> {
    const filas = await todas<{ documento: unknown }>(
      (a, b) => db.from("documentos_vigentes").select("documento").not("documento", "is", null).order("ref_interna").range(a, b),
      "leer documentos",
    );
    return filas.map((r) => r.documento as DocumentoRecibido);
  }

  /** Solo las refs con documento (sin bajar los adjuntos en base64). */
  async function refsConDocumento(): Promise<Set<string>> {
    const filas = await todas<{ ref_interna: string }>(
      (a, b) => db.from("documentos_vigentes").select("ref_interna").not("documento", "is", null).order("ref_interna").range(a, b),
      "leer refs",
    );
    return new Set(filas.map((r) => r.ref_interna));
  }

  /**
   * Fila de `empresas` (#84) sobre los valores de data/empresa.json. Si la fila falta, está a medio llenar o no valida,
   * se usan los de data/ (la app nunca queda sin nombre de empresa).
   */
  async function empresa(): Promise<Empresa> {
    const base = g.datos.empresa;
    const { data, error } = await db.from("empresas").select("nombre, jurisdiccion, paises_operacion, moneda_base, zona_horaria").eq("id", base.id).maybeSingle();
    fallar("leer empresa", error);
    if (!data || !data.jurisdiccion) return structuredClone(base);
    const leida = EmpresaSchema.safeParse({ id: base.id, ...data });
    return leida.success ? leida.data : structuredClone(base);
  }

  return {
    async datosComunes() {
      const [vs, bs, emp] = await Promise.all([versiones(), beneficiarios(), empresa()]);
      return { ...g.datos, empresa: emp, beneficiarios: bs, reglas: { vigente: versionVigente(vs), versiones: vs } };
    },
    empresa,
    async guardarEmpresa(cambios: CambiosEmpresa) {
      const actual = await empresa();
      const { error } = await db
        .from("empresas")
        .upsert({ ...actual, ...cambios, actualizada_en: new Date().toISOString() }, { onConflict: "id" });
      fallar("guardar empresa", error);
      return empresa();
    },
    async reglasVigentes() {
      return versionVigente(await versiones());
    },
    async reglasVersion(version) {
      const { data, error } = await db.from("reglas_vigentes").select("reglas").eq("version", version).maybeSingle();
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
    async vincularTelegram(beneficiario_id, chat_id) {
      const existe = g.datos.beneficiarios.some((b) => b.id === beneficiario_id) || (await agregados()).some((b) => b.id === beneficiario_id);
      if (!existe) throw new Error(`no existe el beneficiario ${beneficiario_id}`);
      // Atómico en la base: borra el vínculo anterior del chat y del beneficiario e inserta el nuevo.
      const { error } = await db.rpc("vincular_telegram", { p_beneficiario: beneficiario_id, p_chat: chat_id });
      fallar("vincular Telegram", error);
    },
    async guardarArchivo(ref, archivo) {
      const corrida = await db.rpc("corrida_vigente");
      fallar("corrida vigente", corrida.error);
      const ruta = rutaArchivo(Number(corrida.data), ref, archivo.nombre);
      const subida = await db.storage.from(BUCKET).upload(ruta, archivo.bytes, { contentType: archivo.mime, upsert: true });
      fallar("subir archivo", subida.error);
      const { error } = await db
        .from("documentos")
        .upsert({ ref_interna: ref, archivo_ruta: ruta, archivo_nombre: archivo.nombre, archivo_mime: archivo.mime }, { onConflict: "corrida_id,ref_interna" });
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
    async leerAdjunto(ref, indice) {
      return leerAdjuntoDe((await filaDocumento(ref))?.documento as DocumentoRecibido | null | undefined, indice, g.escenario.carpeta);
    },
    async siguienteRef(anio) {
      // Consecutivo atómico en la base. El mínimo deja libres las refs reservadas por el escenario y las del historial.
      const minimo = maxRef([...refsGolden, ...g.escenario.historial.map((e) => e.ref_interna)], anio) + 1;
      const { data, error } = await db.rpc("siguiente_secuencia", { p_nombre: `INT-${anio}`, p_minimo: minimo });
      fallar("siguiente ref", error);
      return formatoRef(anio, Number(data));
    },
    async siguienteIdRegistro(anio) {
      // Solo el id más alto del año (los ids del año crecen con la inserción): sin bajar todo el registro.
      const { data, error } = await db.from("registro_vigente").select("entrada").like("id", `REG-${anio}-%`).order("id", { ascending: false }).limit(1);
      fallar("último id", error);
      return siguienteIdRegistro((data ?? []).map((r) => r.entrada as EntradaRegistro), String(anio));
    },
    async guardarDocumento(d) {
      const { error } = await db.from("documentos").upsert({ ref_interna: d.ref_interna, documento: d }, { onConflict: "corrida_id,ref_interna" });
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
    escenario() {
      return Promise.resolve(escenario);
    },
    // Exclusividad dentro del proceso. Durante un deploy Railway corre el contenedor viejo y el nuevo a la vez:
    // si los dos escriben al mismo tiempo, la clave única de `registro.id` y de `reglas_versiones.version` hace
    // fallar uno (error visible, nunca una decisión duplicada ni un registro pisado).
    enExclusiva,
    documentosEscenario() {
      return Promise.resolve([...g.docs]);
    },
    async pendientes() {
      const guardados = await refsConDocumento();
      return g.docs.filter((d) => !guardados.has(d.doc.ref_interna));
    },
    reiniciar(iniciada_por) {
      return enExclusiva(async () => {
        // Corrida y siembra en una sola transacción (función SQL): nunca queda una corrida vigente sin reglas.
        const { error } = await db.rpc("nueva_corrida_demo", {
          p_por: iniciada_por,
          p_escenario: config.escenario,
          p_reglas: g.datos.reglas.versiones.map((v) => ({ version: v.version, reglas: v })),
          p_historial: g.escenario.historial.map(fila),
        });
        fallar("nueva corrida", error);
      });
    },
    async tokenVinculoUsado(huella) {
      // En la tabla, no en la vista: un enlace usado en una corrida anterior tampoco vuelve a valer.
      const { data, error } = await db.from("registro").select("id").eq("tipo", "CAMBIO_BENEFICIARIOS").eq("entrada->>sha256", huella).limit(1);
      fallar("huella de enlace", error);
      return (data ?? []).length > 0;
    },
  };
}
