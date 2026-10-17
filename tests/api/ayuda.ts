// Repositorio fresco del lote demo por test, y helpers para entradas sintéticas.

import type { EntradaRegistro } from "@/dominio/tipos";
import type { Sesion } from "@/lib/auth/permisos";
import { fijarRepositorio } from "@/repositorio";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import type { Repositorio } from "@/repositorio/repositorio";
import { procesarPendientes } from "@/servicios/lote";

/**
 * Sesión simulada para las rutas (`conRol` de #25). Cada archivo de test que llama rutas declara:
 *   vi.mock("server-only", () => ({}));
 *   vi.mock("@/lib/auth/sesion", async () => (await import("./ayuda")).sesionFalsa);
 *   vi.mock("@/lib/auth/auditoria", () => ({ auditar: () => undefined }));
 * Por defecto actúa tesorería; `comoAprobador("lm")` cambia a un aprobador.
 */
export const TESORERIA: Sesion = {
  usuario_id: "u-tesoreria",
  correo: "tesoreria@nebula.example",
  rol: "tesoreria",
  aprobador_id: null,
  beneficiario_id: null,
  nombre: "Tesorería",
};
let sesionActual: Sesion | null = TESORERIA;
export const sesionFalsa = { obtenerSesion: async () => sesionActual };
export function comoSesion(s: Sesion | null) {
  sesionActual = s;
}
export function comoAprobador(aprobador_id: string) {
  sesionActual = { ...TESORERIA, usuario_id: `u-${aprobador_id}`, rol: "aprobador", aprobador_id, nombre: aprobador_id };
}
export function comoProveedor(beneficiario_id: string) {
  sesionActual = { ...TESORERIA, usuario_id: `u-${beneficiario_id}`, rol: "proveedor", beneficiario_id, nombre: beneficiario_id };
}

/** Petición del mismo origen (la guardia rechaza escrituras sin Origin, CSRF). */
export function peticion(url: string, init: RequestInit = {}): Request {
  return new Request(url, { ...init, headers: { origin: new URL(url).origin, ...init.headers } });
}

export async function repoProcesado(): Promise<Repositorio> {
  const repo = await crearRepositorioMemoria("lote-demo-oct");
  await procesarPendientes(repo);
  fijarRepositorio(repo);
  comoSesion(TESORERIA);
  return repo;
}

export async function entradaDe(repo: Repositorio, numero: string): Promise<EntradaRegistro> {
  const e = (await repo.registro({ tipo: ["DECISION_AGENTE"] })).findLast((x) => x.factura_numero === numero);
  if (!e) throw new Error(`sin entrada para ${numero}`);
  return e;
}

/** ESCALAR sintético: copia de LF-2026-10 con otro monto y otra ref (para límites y doble aprobación). */
export async function escaladaSintetica(repo: Repositorio, usd_centavos: number): Promise<string> {
  const base = await entradaDe(repo, "LF-2026-10");
  const ref = await repo.siguienteRef(2026);
  await repo.agregarEntrada({
    ...base,
    id: await repo.siguienteIdRegistro(2026),
    ref_interna: ref,
    factura_numero: `SINT-${usd_centavos}`,
    monto_original: { centavos: usd_centavos, moneda: "USD" },
    monto_usd_centavos: usd_centavos,
  });
  return ref;
}
