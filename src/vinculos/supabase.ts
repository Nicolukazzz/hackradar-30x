import "server-only";

import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { AlmacenEnlaces } from "./almacen";
import { ErrorCodigoRepetido, type EnlaceConCodigo } from "./tipos";

// Portal del proveedor en Supabase (migración 20261017232107_portal_proveedor.sql). Llave secreta: la tabla no tiene
// acceso desde el cliente. El código y el token se guardan solo como sha256.

const TABLA = "enlaces_proveedor";
const PUBLICAS = "id, nombre, correo, beneficiario_id, creado_por, creado_en, expira_en, revocado_en, codigo_cambiado_en, ultimo_acceso";

const Fila = z.object({
  id: z.string(),
  nombre: z.string(),
  correo: z.string(),
  beneficiario_id: z.string().nullable(),
  creado_por: z.string().nullable(),
  creado_en: z.string(),
  expira_en: z.string(),
  revocado_en: z.string().nullable(),
  codigo_cambiado_en: z.string().nullable(),
  ultimo_acceso: z.string().nullable(),
});
const FilaConCodigo = Fila.extend({ codigo_hash: z.string() });

function fallar(error: PostgrestError, que: string): never {
  if (error.code === "23505") throw new ErrorCodigoRepetido();
  throw new Error(`Supabase (${que}): ${error.message}`);
}

export function crearAlmacenEnlacesSupabase(config: { url: string; claveSecreta: string }): AlmacenEnlaces {
  const db: SupabaseClient = createClient(config.url, config.claveSecreta, { auth: { persistSession: false, autoRefreshToken: false } });

  async function una(columna: "id" | "token_hash", valor: string): Promise<EnlaceConCodigo | null> {
    const { data, error } = await db.from(TABLA).select(`${PUBLICAS}, codigo_hash`).eq(columna, valor).maybeSingle();
    if (error) fallar(error, "enlace de proveedor");
    return data ? FilaConCodigo.parse(data) : null;
  }

  return {
    async listar() {
      const { data, error } = await db.from(TABLA).select(PUBLICAS).order("creado_en", { ascending: false }).limit(200);
      if (error) fallar(error, "enlaces de proveedor");
      return z.array(Fila).parse(data);
    },
    porId: (id) => una("id", id),
    porHash: (token_hash) => una("token_hash", token_hash),
    async crear(nuevo) {
      const { data, error } = await db.from(TABLA).insert(nuevo).select(PUBLICAS).single();
      if (error) fallar(error, "crear enlace de proveedor");
      return Fila.parse(data);
    },
    async revocar(id, ahora) {
      const { data, error } = await db.from(TABLA).update({ revocado_en: ahora }).eq("id", id).is("revocado_en", null).select("id");
      if (error) fallar(error, "revocar enlace de proveedor");
      return (data ?? []).length > 0;
    },
    async cambiarCodigo(id, codigo_hash, ahora) {
      const { data, error } = await db.from(TABLA).update({ codigo_hash, codigo_cambiado_en: ahora }).eq("id", id).is("revocado_en", null).select("id");
      if (error) fallar(error, "cambiar código");
      return (data ?? []).length > 0;
    },
    async borrar(id, ahora) {
      // Solo lo que ya no sirve: revocado, o vencido según la hora del servidor.
      const { data, error } = await db.from(TABLA).delete().eq("id", id).or(`revocado_en.not.is.null,expira_en.lte."${ahora}"`).select("id");
      if (error) fallar(error, "borrar enlace");
      return (data ?? []).length > 0;
    },
    async registrarAcceso(id, ahora) {
      const { error } = await db.from(TABLA).update({ ultimo_acceso: ahora }).eq("id", id);
      if (error) fallar(error, "registrar acceso");
    },
  };
}
