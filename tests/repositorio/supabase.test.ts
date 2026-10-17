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

  it("más de 1000 filas en el registro: se leen todas (PostgREST corta en 1000) y el siguiente id es el correcto", async () => {
    const db = createClient(url!, claveSecreta!, { auth: { persistSession: false } });
    const repo = await crear();
    const antes = (await repo.registro()).length;
    const [base] = await repo.registro({ tipo: ["DECISION_AGENTE"] });
    const nuevas = Array.from({ length: 1100 }, (_, i) => {
      const id = `REG-2027-${String(i + 1).padStart(6, "0")}`;
      return { id, ref_interna: `INT-2027-${String(i + 1).padStart(6, "0")}`, tipo: "DECISION_AGENTE", decision: "FRENAR", entrada: { ...base, id } };
    });
    const { error } = await db.from("registro").insert(nuevas);
    expect(error).toBeNull();
    expect(await repo.registro()).toHaveLength(antes + 1100);
    expect(await repo.siguienteIdRegistro(2027)).toBe("REG-2027-001101");
  });

  it("corridas (#76): reiniciar no borra; la corrida anterior sigue en la tabla y sigue siendo inmutable", async () => {
    const db = createClient(url!, claveSecreta!, { auth: { persistSession: false } });
    const { data: corridas } = await db.from("demo_corridas").select("id").order("id");
    expect((corridas ?? []).length).toBeGreaterThanOrEqual(2);
    const { count } = await db.from("registro").select("id", { count: "exact", head: true }).eq("corrida_id", 1).eq("id", "REG-2026-000011");
    expect(count).toBe(1);
    const { error: editar } = await db.from("registro").update({ decision: "PAGAR" }).eq("corrida_id", 1).eq("id", "REG-2026-000011");
    expect(editar?.message).toMatch(/permission denied|append-only/);
    const { error: borrarCorrida } = await db.from("demo_corridas").delete().eq("id", 1);
    expect(borrarCorrida?.message).toMatch(/permission denied/);
  });

  it("sin llave secreta no se lee nada (anon)", async () => {
    const anon = createClient(url!, process.env.SUPABASE_PRUEBA_PUBLICA ?? "", { auth: { persistSession: false } });
    const { data } = await anon.from("registro").select("id").limit(1);
    expect(data ?? []).toEqual([]);
  });
});
