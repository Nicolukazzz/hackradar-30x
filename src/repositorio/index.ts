// Repositorio único del proceso, elegido por REPOSITORIO=memoria|supabase (por defecto memoria)
// y ESCENARIO. Memoria: por defecto lote-demo-oct. Supabase: sin ESCENARIO es producción sin datos de ejemplo (#106). Se guarda en globalThis para sobrevivir a la recarga
// en caliente de `next dev`.

import type { Aprobador } from "@/dominio/tipos";
import { relojSistema } from "@/lib/reloj-sistema";

import { crearRepositorioMemoria } from "./memoria";
import type { Repositorio } from "./repositorio";

export type { Repositorio } from "./repositorio";

const CLAVE = Symbol.for("hackradar.repositorio");
type Global = typeof globalThis & { [CLAVE]?: Promise<Repositorio> };

function crear(): Promise<Repositorio> {
  const tipo = process.env.REPOSITORIO ?? "memoria";
  if (tipo === "supabase") {
    const escenario = process.env.ESCENARIO?.trim() || null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const claveSecreta = process.env.SUPABASE_SECRET_KEY;
    if (!url || !claveSecreta) return Promise.reject(new Error("REPOSITORIO=supabase necesita NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY"));
    return import("./supabase").then((m) => m.crearRepositorioSupabase({ url, claveSecreta, escenario, aprobadores: aprobadoresDelEquipoActual, hoy: hoyEn }));
  }
  return crearRepositorioMemoria(process.env.ESCENARIO ?? "lote-demo-oct");
}

/** AAAA-MM-DD de hoy en la zona de la empresa (para la foto diaria de tasas, #86). */
function hoyEn(zona: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return relojSistema().ahora().slice(0, 10); // zona inválida: hora de Bogotá
  }
}

/** Cuentas del equipo que firman (#106). Import dinámico: el equipo no se carga en tests del repositorio. */
async function aprobadoresDelEquipoActual(): Promise<Aprobador[]> {
  const [{ obtenerAlmacenEquipo }, { aprobadoresDelEquipo }, { EMPRESA_ID }] = await Promise.all([
    import("@/equipo"),
    import("@/equipo/aprobadores"),
    import("@/equipo/tipos"),
  ]);
  return aprobadoresDelEquipo(await (await obtenerAlmacenEquipo()).miembros(EMPRESA_ID));
}

export function obtenerRepositorio(): Promise<Repositorio> {
  const g = globalThis as Global;
  g[CLAVE] ??= crear().catch((e: unknown) => {
    g[CLAVE] = undefined; // que el próximo pedido reintente
    throw e;
  });
  return g[CLAVE];
}

/** "Reiniciar demo" (#76): corrida nueva, como recién sembrada. En Supabase las anteriores quedan guardadas. */
export async function reiniciarRepositorio(iniciada_por: string): Promise<Repositorio> {
  const repo = await obtenerRepositorio();
  await repo.reiniciar(iniciada_por);
  return repo;
}

/** Solo tests: usa un repositorio concreto. */
export function fijarRepositorio(r: Repositorio | Promise<Repositorio>): void {
  (globalThis as Global)[CLAVE] = Promise.resolve(r);
}
