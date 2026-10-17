import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { crearRepositorioSupabase } from "@/repositorio/supabase";

import { contratoRepositorio } from "./contrato";

// Solo con Supabase local y la base recién reiniciada: `npm run test:supabase`. En CI se salta.
const url = process.env.SUPABASE_PRUEBA_URL;
const claveSecreta = process.env.SUPABASE_PRUEBA_CLAVE;

describe.skipIf(!url || !claveSecreta)("contrato del repositorio: Supabase", () => {
  const crear = () => crearRepositorioSupabase({ url: url!, claveSecreta: claveSecreta!, escenario: "lote-demo-oct" });
  contratoRepositorio(crear, { persistente: true });

  it("append-only en la base: ni la llave secreta puede editar ni borrar el registro", async () => {
    const db = createClient(url!, claveSecreta!, { auth: { persistSession: false } });
    const { error: editar } = await db.from("registro").update({ decision: "PAGAR" }).eq("id", "REG-2026-000011");
    // Dos capas: service_role no tiene permiso de UPDATE/DELETE y, aunque lo tuviera, el trigger lo rechaza.
    expect(editar?.message).toMatch(/permission denied|append-only/);
    const { error: borrar } = await db.from("registro").delete().eq("id", "REG-2026-000011");
    expect(borrar?.message).toMatch(/permission denied|append-only/);
  });

  it("sin llave secreta no se lee nada (anon)", async () => {
    const anon = createClient(url!, process.env.SUPABASE_PRUEBA_PUBLICA ?? "", { auth: { persistSession: false } });
    const { data } = await anon.from("registro").select("id").limit(1);
    expect(data ?? []).toEqual([]);
  });
});
