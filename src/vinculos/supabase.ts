import "server-only";

import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { AlmacenEnlaces } from "./almacen";
import type { EnlaceProveedor } from "./tipos";

// Enlaces de proveedor en Supabase (migración 20261017223855_enlaces_proveedor.sql). Llave secreta: la tabla no tiene
// acceso desde el cliente. Usar el enlace es atómico en la base (`usar_enlace_proveedor`), con su propio reloj.

const TABLA = "enlaces_proveedor";
const COLUMNAS = "id, beneficiario_id, nombre, creado_por, creado_en, expira_en, revocado_en, usado_en, correo, conexion_id";

const Fila = z.object({
  id: z.string(),
  beneficiario_id: z.string().nullable(),
  nombre: z.string(),
  creado_por: z.string().nullable(),
  creado_en: z.string(),
  expira_en: z.string(),
  revocado_en: z.string().nullable(),
  usado_en: z.string().nullable(),
  correo: z.string().nullable(),
  conexion_id: z.string().nullable(),
});

function fallar(error: PostgrestError, que: string): never {
  throw new Error(`Supabase (${que}): ${error.message}`);
}

export function crearAlmacenEnlacesSupabase(config: { url: string; claveSecreta: string }): AlmacenEnlaces {
  const db: SupabaseClient = createClient(config.url, config.claveSecreta, { auth: { persistSession: false, autoRefreshToken: false } });

  async function una(columna: "id" | "token_hash", valor: string): Promise<EnlaceProveedor | null> {
    const { data, error } = await db.from(TABLA).select(COLUMNAS).eq(columna, valor).maybeSingle();
    if (error) fallar(error, "enlace de proveedor");
    return data ? Fila.parse(data) : null;
  }

  return {
    async listar() {
      const { data, error } = await db.from(TABLA).select(COLUMNAS).order("creado_en", { ascending: false }).limit(100);
      if (error) fallar(error, "enlaces de proveedor");
      return z.array(Fila).parse(data);
    },
    porHash: (token_hash) => una("token_hash", token_hash),
    async crear(nuevo) {
      const { data, error } = await db.from(TABLA).insert(nuevo).select(COLUMNAS).single();
      if (error) fallar(error, "crear enlace de proveedor");
      return Fila.parse(data);
    },
    async revocar(id, ahora) {
      const { data, error } = await db.from(TABLA).update({ revocado_en: ahora }).eq("id", id).is("revocado_en", null).is("usado_en", null).select("id");
      if (error) fallar(error, "revocar enlace de proveedor");
      return (data ?? []).length > 0;
    },
    async usar(token_hash, correo, conexion_id) {
      const { data, error } = await db.rpc("usar_enlace_proveedor", { p_token_hash: token_hash, p_correo: correo, p_conexion: conexion_id });
      if (error) fallar(error, "usar enlace de proveedor");
      const id = z.string().nullable().parse(data ?? null);
      return id ? una("id", id) : null;
    },
  };
}
