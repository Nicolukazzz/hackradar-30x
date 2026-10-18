// Repositorio fresco del lote demo por test, y helpers para entradas sintéticas.

import type { EntradaRegistro } from "@/dominio/tipos";
import { fijarAlmacenEquipo } from "@/equipo";
import { crearAlmacenEquipoMemoria, type AlmacenEquipoMemoria } from "@/equipo/memoria";
import { EMPRESA_ID } from "@/equipo/tipos";
import { relojFijo } from "@/dominio/reloj";
import type { Rol, Sesion } from "@/lib/auth/permisos";
import { fijarRepositorio } from "@/repositorio";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import type { Repositorio } from "@/repositorio/repositorio";
import { procesarPendientes } from "@/servicios/lote";

/**
 * Sesión simulada para las rutas (`conSesion`, #51: rol por membresía). Cada archivo de test que llama rutas declara:
 *   vi.mock("server-only", () => ({}));
 *   vi.mock("@/lib/auth/sesion", async () => (await import("./ayuda")).sesionFalsa);
 *   vi.mock("@/lib/auth/auditoria", () => ({ auditar: () => undefined }));
 * Por defecto actúa una cuenta admin (Ana); `comoCuenta("Beto", "aprobador")` cambia a otra cuenta y la hace
 * miembro del equipo en memoria (las firmas de §10 se buscan ahí).
 */
export const CUENTA: Sesion = { usuario_id: "u-ana", correo: "ana@nebula.example", nombre: "Ana Torres", rol: "admin", limite_aprobacion_usd: null };
let sesionActual: Sesion | null = CUENTA;
let equipo: AlmacenEquipoMemoria = nuevoEquipo();
export const sesionFalsa = { obtenerSesion: async () => sesionActual };

function nuevoEquipo(): AlmacenEquipoMemoria {
  const a = crearAlmacenEquipoMemoria(relojFijo("2026-10-16T09:00:00-05:00"));
  fijarAlmacenEquipo(a);
  return a;
}

/** Almacén del equipo en memoria del test actual. */
export function equipoActual(): AlmacenEquipoMemoria {
  return equipo;
}

/** Fija la sesión y, si tiene rol, la deja como miembro del equipo (como si hubiera aceptado una invitación). */
export function comoSesion(s: Sesion | null) {
  sesionActual = s;
  if (!s) return;
  equipo.agregarCuenta({ usuario_id: s.usuario_id, nombre: s.nombre, correo: s.correo });
  if (s.rol) equipo.agregarMiembro(EMPRESA_ID, s.usuario_id, s.rol, s.limite_aprobacion_usd);
}

export function comoCuenta(nombre: string, rol: Rol | null = "admin", limite_aprobacion_usd: number | null = null) {
  const id = nombre.toLowerCase().replaceAll(/\s+/g, "-");
  comoSesion({ usuario_id: `u-${id}`, correo: `${id}@nebula.example`, nombre, rol, limite_aprobacion_usd });
}

/** Petición del mismo origen (la guardia rechaza escrituras sin Origin, CSRF). */
export function peticion(url: string, init: RequestInit = {}): Request {
  return new Request(url, { ...init, headers: { origin: new URL(url).origin, ...init.headers } });
}

export async function repoProcesado(): Promise<Repositorio> {
  const repo = await crearRepositorioMemoria("lote-demo-oct");
  await procesarPendientes(repo);
  fijarRepositorio(repo);
  equipo = nuevoEquipo();
  comoSesion(CUENTA);
  return repo;
}

export async function entradaDe(repo: Repositorio, numero: string): Promise<EntradaRegistro> {
  const e = (await repo.registro({ tipo: ["DECISION_AGENTE"] })).findLast((x) => x.factura_numero === numero);
  if (!e) throw new Error(`sin entrada para ${numero}`);
  return e;
}

/**
 * Proveedor nuevo invitado al portal (#85): R3 falla pero escala (no frena) para que una persona apruebe y lo agregue.
 * Copia de la decisión de TD-001 (frenada por R3 desde 2026-10-18) como si hubiera llegado por el enlace de invitación.
 */
export async function escaladaPorInvitacion(repo: Repositorio): Promise<EntradaRegistro> {
  const td = await entradaDe(repo, "TD-001");
  const e: EntradaRegistro = {
    ...td,
    id: await repo.siguienteIdRegistro(2026),
    decision: "ESCALAR",
    evaluaciones: td.evaluaciones.map((x) => (x.id === "R3" ? { ...x, si_falla: "ESCALAR" as const, datos: { ...x.datos, invitado: true } } : x)),
  };
  await repo.agregarEntrada(e);
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
