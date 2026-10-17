import "server-only";

import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { ROLES, type Rol } from "@/lib/auth/permisos";

import type { AlmacenEquipo } from "./almacen";
import { ErrorEquipo, MENSAJE_ULTIMO_ADMIN, type Invitacion, type Miembro, type NuevaInvitacion, type ResultadoAceptar } from "./tipos";

// Almacén del equipo en Supabase (migración 20261017073944_equipo_roles.sql). Llave secreta: las tablas no
// tienen acceso desde el cliente. Aceptar una invitación y el último admin se resuelven en la base (función
// `aceptar_invitacion` y trigger), así dos peticiones a la vez no se saltan las reglas.

const COLUMNAS_INVITACION = "id, rol, limite_aprobacion_usd, correo_esperado, creada_por, creada_en, expira_en, usos_max, usos, revocada_en";

const FilaInvitacion = z.object({
  id: z.string(),
  rol: z.enum(ROLES),
  limite_aprobacion_usd: z.number().int().nullable(),
  correo_esperado: z.string().nullable(),
  creada_por: z.string().nullable(),
  creada_en: z.string(),
  expira_en: z.string(),
  usos_max: z.number().int(),
  usos: z.number().int(),
  revocada_en: z.string().nullable(),
});

const FilaMiembro = z.object({
  usuario_id: z.string(),
  nombre: z.string(),
  correo: z.string().nullable(),
  rol: z.enum(ROLES),
  limite_aprobacion_usd: z.number().int().nullable(),
  activo: z.boolean(),
  creada_en: z.string(),
});

const Resultado = z.enum(["aceptada", "invalida", "otro_correo", "ya_miembro"]);

function fallar(error: PostgrestError, que: string): never {
  if (error.hint === "ultimo_admin") throw new ErrorEquipo(409, MENSAJE_ULTIMO_ADMIN);
  throw new Error(`Supabase (${que}): ${error.message}`);
}

export function crearAlmacenEquipoSupabase(config: { url: string; claveSecreta: string }): AlmacenEquipo {
  const db: SupabaseClient = createClient(config.url, config.claveSecreta, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    async miembros(empresa_id): Promise<Miembro[]> {
      const { data, error } = await db.rpc("miembros_empresa", { p_empresa: empresa_id });
      if (error) fallar(error, "miembros");
      return z
        .array(FilaMiembro)
        .parse(data)
        .map(({ creada_en, correo, ...m }) => ({ ...m, correo: correo ?? "", desde: creada_en }));
    },

    async invitaciones(empresa_id, ahora): Promise<Invitacion[]> {
      // Las vigentes van siempre (vencen en ≤ 30 días, son pocas): una invitación activa que no se ve no se puede revocar.
      const base = () => db.from("invitaciones").select(COLUMNAS_INVITACION).eq("empresa_id", empresa_id);
      const [vigentes, recientes] = await Promise.all([
        base().is("revocada_en", null).gt("expira_en", new Date(Date.parse(ahora)).toISOString()),
        base().order("creada_en", { ascending: false }).limit(50),
      ]);
      if (vigentes.error) fallar(vigentes.error, "invitaciones");
      if (recientes.error) fallar(recientes.error, "invitaciones");
      const porId = new Map(z.array(FilaInvitacion).parse([...vigentes.data, ...recientes.data]).map((i) => [i.id, i]));
      return [...porId.values()].sort((a, b) => Date.parse(b.creada_en) - Date.parse(a.creada_en));
    },

    async invitacionPorHash(empresa_id, token_hash) {
      const { data, error } = await db
        .from("invitaciones")
        .select(COLUMNAS_INVITACION)
        .eq("empresa_id", empresa_id)
        .eq("token_hash", token_hash)
        .maybeSingle();
      if (error) fallar(error, "invitación");
      return data ? FilaInvitacion.parse(data) : null;
    },

    async crearInvitacion(empresa_id, nueva: NuevaInvitacion) {
      const { data, error } = await db
        .from("invitaciones")
        .insert({ empresa_id, ...nueva })
        .select(COLUMNAS_INVITACION)
        .single();
      if (error) fallar(error, "crear invitación");
      return FilaInvitacion.parse(data);
    },

    async revocarInvitacion(empresa_id, id, ahora) {
      const { data, error } = await db
        .from("invitaciones")
        .update({ revocada_en: ahora })
        .eq("empresa_id", empresa_id)
        .eq("id", id)
        .is("revocada_en", null)
        .select("id");
      if (error) fallar(error, "revocar invitación");
      return (data ?? []).length > 0;
    },

    async aceptarInvitacion(token_hash, usuario_id, correo): Promise<ResultadoAceptar> {
      const { data, error } = await db.rpc("aceptar_invitacion", { p_token_hash: token_hash, p_usuario: usuario_id, p_correo: correo });
      if (error) fallar(error, "aceptar invitación");
      return Resultado.parse(data);
    },

    async cambiarMiembro(empresa_id, usuario_id, rol: Rol, limite_aprobacion_usd, ahora) {
      const { error } = await db
        .from("membresias")
        .update({ rol, limite_aprobacion_usd, actualizada_en: new Date(Date.parse(ahora)).toISOString() })
        .eq("empresa_id", empresa_id)
        .eq("usuario_id", usuario_id);
      if (error) fallar(error, "cambiar miembro");
    },

    async quitarMiembro(empresa_id, usuario_id) {
      const { error } = await db.from("membresias").delete().eq("empresa_id", empresa_id).eq("usuario_id", usuario_id);
      if (error) fallar(error, "quitar miembro");
    },
  };
}
