import "server-only";

import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { AlmacenInvitaciones } from "./almacen";
import type { InvitacionProveedor } from "./tipos";

// Invitaciones de proveedor en Supabase (migración 20261017100000_invitaciones_proveedor.sql). Llave secreta: la
// tabla no tiene acceso desde el cliente. Usar el enlace es atómico en la base (`usar_invitacion_proveedor`).

const COLUMNAS = "id, nombre_esperado, correo_esperado, creada_por, creada_en, expira_en, usos_max, usos, revocada_en";

const Fila = z.object({
  id: z.string(),
  nombre_esperado: z.string().nullable(),
  correo_esperado: z.string().nullable(),
  creada_por: z.string().nullable(),
  creada_en: z.string(),
  expira_en: z.string(),
  usos_max: z.number().int(),
  usos: z.number().int(),
  revocada_en: z.string().nullable(),
});

const Uso = z.object({ resultado: z.enum(["ok", "invalida", "otro_correo"]), invitacion_id: z.string().nullable() });

function fallar(error: PostgrestError, que: string): never {
  throw new Error(`Supabase (${que}): ${error.message}`);
}

export function crearAlmacenInvitacionesSupabase(config: { url: string; claveSecreta: string }): AlmacenInvitaciones {
  const db: SupabaseClient = createClient(config.url, config.claveSecreta, { auth: { persistSession: false, autoRefreshToken: false } });

  async function una(columna: "id" | "token_hash", valor: string): Promise<InvitacionProveedor | null> {
    const { data, error } = await db.from("invitaciones_proveedor").select(COLUMNAS).eq(columna, valor).maybeSingle();
    if (error) fallar(error, "invitación de proveedor");
    return data ? Fila.parse(data) : null;
  }

  return {
    async listar() {
      const { data, error } = await db.from("invitaciones_proveedor").select(COLUMNAS).order("creada_en", { ascending: false }).limit(50);
      if (error) fallar(error, "invitaciones de proveedor");
      return z.array(Fila).parse(data);
    },
    porId: (id) => una("id", id),
    porHash: (token_hash) => una("token_hash", token_hash),
    async crear(nueva) {
      const { data, error } = await db.from("invitaciones_proveedor").insert(nueva).select(COLUMNAS).single();
      if (error) fallar(error, "crear invitación de proveedor");
      return Fila.parse(data);
    },
    async revocar(id, ahora) {
      const { data, error } = await db.from("invitaciones_proveedor").update({ revocada_en: ahora }).eq("id", id).is("revocada_en", null).select("id");
      if (error) fallar(error, "revocar invitación de proveedor");
      return (data ?? []).length > 0;
    },
    async usar(token_hash, correo) {
      // La base usa su propio now(): el reloj del servidor web no decide si el enlace venció.
      const { data, error } = await db.rpc("usar_invitacion_proveedor", { p_token_hash: token_hash, p_correo: correo }).single();
      if (error) fallar(error, "usar invitación de proveedor");
      const uso = Uso.parse(data);
      return { resultado: uso.resultado, invitacion: uso.invitacion_id ? await una("id", uso.invitacion_id) : null };
    },
  };
}
