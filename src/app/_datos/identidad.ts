// Quién está decidiendo. Única puerta (rutas y pantallas): NINGUNA ruta lee aprobador_id del body.
//
// Hoy (sin login) es la elección demo "Actuar como" de la pantalla Aprobaciones, guardada en la cookie
// `actuar_como`. #25 reemplaza esta función por `exigirRol('aprobador')` con la sesión verificada de
// Supabase; las rutas no cambian.

import { cookies } from "next/headers";

import type { Aprobador } from "@/dominio/tipos";
import { obtenerRepositorio } from "@/repositorio";
import type { Repositorio } from "@/repositorio/repositorio";

export const COOKIE_ACTUAR_COMO = "actuar_como";

/**
 * Rutas y cookie de demo (actuar como, reiniciar): siempre en desarrollo; en producción solo con DEMO=1.
 * Sin login (#25), cualquiera que llegue a la URL podría actuar como la CFO: activarlo a propósito y solo para la demo.
 */
export function demoActiva(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.DEMO === "1";
}

export async function aprobadorDeLaPeticion(repo: Repositorio): Promise<Aprobador | null> {
  if (!demoActiva()) return null;
  const id = (await cookies()).get(COOKIE_ACTUAR_COMO)?.value;
  if (!id) return null;
  const { aprobadores } = await repo.datosComunes();
  return aprobadores.find((a) => a.id === id) ?? null;
}

/** Para las pantallas: con quién se está actuando y entre quiénes se puede elegir. */
export async function sesionDemo(): Promise<{
  actual: Pick<Aprobador, "id" | "nombre" | "rol" | "iniciales" | "limite_usd" | "principal"> | null;
  aprobadores: Pick<Aprobador, "id" | "nombre" | "rol" | "iniciales" | "limite_usd" | "principal">[];
  demo: boolean;
}> {
  const repo = await obtenerRepositorio();
  const [{ aprobadores }, actual] = await Promise.all([repo.datosComunes(), aprobadorDeLaPeticion(repo)]);
  const corto = ({ id, nombre, rol, iniciales, limite_usd, principal }: Aprobador) => ({ id, nombre, rol, iniciales, limite_usd, principal });
  return { actual: actual ? corto(actual) : null, aprobadores: aprobadores.map(corto), demo: demoActiva() };
}
