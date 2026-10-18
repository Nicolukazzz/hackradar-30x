// Almacén de tasas en Supabase (#86): tabla `tasas_dia`, una foto por base y día. Solo servidor.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Moneda } from "@/dominio/tipos";

import type { AlmacenTasas, FotoTasas } from "./tipos";

type Fila = { fecha: string; base: string; tasas: Partial<Record<Moneda, string>>; fuente: string };
const foto = (f: Fila): FotoTasas => ({ fecha: f.fecha, base: f.base as Moneda, tasas: f.tasas, fuente: f.fuente });

export function almacenTasasSupabase(db: SupabaseClient): AlmacenTasas {
  return {
    async delDia(base, fecha) {
      const { data, error } = await db.from("tasas_dia").select("fecha, base, tasas, fuente").eq("base", base).eq("fecha", fecha).maybeSingle();
      if (error) throw new Error(`Supabase (tasas del día): ${error.message}`);
      return data ? foto(data as Fila) : null;
    },
    async ultima(base, hasta) {
      const { data, error } = await db.from("tasas_dia").select("fecha, base, tasas, fuente").eq("base", base).lte("fecha", hasta).order("fecha", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error(`Supabase (última tasa): ${error.message}`);
      return data ? foto(data as Fila) : null;
    },
    async guardar(f) {
      // Dos instancias pueden tomar la foto a la vez: la segunda la reemplaza con valores equivalentes.
      const { error } = await db.from("tasas_dia").upsert({ fecha: f.fecha, base: f.base, tasas: f.tasas, fuente: f.fuente }, { onConflict: "base,fecha" });
      if (error) throw new Error(`Supabase (guardar tasas): ${error.message}`);
    },
  };
}
