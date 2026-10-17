// Piezas que comparten el repositorio en memoria y el de Supabase, para que se comporten igual.

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Beneficiario, DocumentoRecibido, EntradaRegistro, Reglas } from "@/dominio/tipos";

import type { ArchivoGuardado, FiltroRegistro } from "./repositorio";

export function coincideFiltro(e: EntradaRegistro, f?: FiltroRegistro): boolean {
  return (
    !f ||
    ((!f.tipo || f.tipo.includes(e.tipo)) &&
      (!f.decision || (e.decision !== null && f.decision.includes(e.decision))) &&
      (!f.actor || e.actor.tipo === f.actor) &&
      (!f.ref_interna || e.ref_interna === f.ref_interna))
  );
}

/** La versión más alta. cargarDatosComunes garantiza al menos una. */
export function versionVigente(versiones: readonly Reglas[]): Reglas {
  const [primera, ...resto] = versiones;
  if (!primera) throw new Error("no hay ninguna versión de reglas cargada");
  return resto.reduce((a, b) => (b.version > a.version ? b : a), primera);
}

/** Mayor número usado en refs `INT-{anio}-NNNNNN` (0 si ninguna). */
export function maxRef(refs: Iterable<string>, anio: number): number {
  const patron = new RegExp(String.raw`^INT-${anio}-(\d{6})$`);
  let max = 0;
  for (const ref of refs) {
    const x = patron.exec(ref);
    if (x) max = Math.max(max, Number(x[1]));
  }
  return max;
}

export const formatoRef = (anio: number, n: number) => `INT-${anio}-${String(n).padStart(6, "0")}`;

/** Cola de escrituras del proceso: cada operación exclusiva espera a que termine la anterior. */
export function crearCola(): <T>(fn: () => Promise<T>) => Promise<T> {
  let cola: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const turno = cola.then(fn, fn);
    cola = turno.catch(() => undefined);
    return turno;
  };
}

/** Adjunto n.º `indice` de un documento: bytes guardados o archivo del escenario, nunca fuera de su carpeta. */
export async function leerAdjuntoDe(doc: DocumentoRecibido | null | undefined, indice: number, carpeta: string): Promise<ArchivoGuardado | null> {
  const adj = doc?.adjuntos[indice];
  if (!adj) return null;
  if (adj.bytes_base64 !== undefined) return { nombre: adj.nombre, mime: adj.mime, bytes: Buffer.from(adj.bytes_base64, "base64") };
  if (adj.ruta === undefined) return null;
  const base = path.resolve(/*turbopackIgnore: true*/ carpeta);
  const ruta = path.resolve(/*turbopackIgnore: true*/ base, adj.ruta);
  if (!ruta.startsWith(base + path.sep)) return null; // nunca fuera de la carpeta del escenario
  return { nombre: adj.nombre, mime: adj.mime, bytes: await readFile(/*turbopackIgnore: true*/ ruta) };
}

/** Aplica los vínculos de Telegram (#13) sobre la lista de beneficiarios: un chat, un beneficiario. */
export function conVinculosTelegram(beneficiarios: readonly Beneficiario[], vinculos: ReadonlyMap<string, string>): Beneficiario[] {
  const chats = new Set(vinculos.values());
  return beneficiarios.map((b) => {
    const chat = vinculos.get(b.id) ?? (b.canales.telegram_chat_id && !chats.has(b.canales.telegram_chat_id) ? b.canales.telegram_chat_id : null);
    return chat === b.canales.telegram_chat_id ? b : { ...b, canales: { ...b.canales, telegram_chat_id: chat } };
  });
}
