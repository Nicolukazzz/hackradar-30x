// Datos de la empresa editables (#84): reglas puras, sin servidor. Las usan la API y la pantalla de Ajustes.

import { z } from "zod";

import type { Empresa } from "@/dominio/tipos";

/** Países donde puede operar la empresa (Blinka paga a EE. UU. y LatAm), en el orden en que se muestran. */
export const PAISES = {
  US: "Estados Unidos",
  CO: "Colombia",
  MX: "México",
  AR: "Argentina",
  BR: "Brasil",
  CL: "Chile",
  PE: "Perú",
  BO: "Bolivia",
  CR: "Costa Rica",
  PA: "Panamá",
  EC: "Ecuador",
  UY: "Uruguay",
  ZA: "Sudáfrica",
} as const;

/** Código ISO de un país que la empresa puede declarar. */
export type CodigoPais = keyof typeof PAISES;
/** Países que se pueden elegir en Ajustes, en el orden de la lista. */
export const CODIGOS_PAIS = Object.keys(PAISES) as CodigoPais[];

const texto = (max: number, campo: string) =>
  z
    .string()
    .transform((s) => s.replaceAll(/\s+/g, " ").trim())
    .pipe(z.string().min(1, `Escribe ${campo}.`).max(max, `Usa hasta ${max} caracteres.`));

/** Cuerpo de PATCH /api/empresa: cualquier subconjunto de los tres campos editables. */
export const EsquemaCambiosEmpresa = z
  .strictObject({
    nombre: texto(120, "el nombre de la empresa"),
    jurisdiccion: texto(120, "la jurisdicción"),
    paises_operacion: z
      .array(z.enum(CODIGOS_PAIS as [CodigoPais, ...CodigoPais[]]), "Elige países de la lista.")
      .min(1, "Elige al menos un país.")
      .transform((ps) => CODIGOS_PAIS.filter((c) => ps.includes(c))),
  })
  .partial()
  .refine((c) => Object.keys(c).length > 0, "No hay nada que cambiar.");

/** Cambios validados de la empresa; al menos uno. */
export type CambiosEmpresaParciales = z.infer<typeof EsquemaCambiosEmpresa>;

/** Nombres de los países separados por coma (un código desconocido se deja tal cual). */
export function nombrePaises(codigos: readonly string[]): string {
  return codigos.map((c) => PAISES[c as CodigoPais] ?? c).join(", ");
}

/** "opera en 5 países" (barra lateral) */
export function resumenOperacion(e: Pick<Empresa, "jurisdiccion" | "paises_operacion">): string {
  const n = e.paises_operacion.length;
  return [e.jurisdiccion, `opera en ${n} ${n === 1 ? "país" : "países"}`].filter(Boolean).join(" · ");
}

/**
 * Frase del registro para un cambio (explicabilidad: se entiende sin abrir la base). Solo nombra lo que cambió;
 * null si nada cambió.
 */
export function describirCambio(antes: Empresa, despues: Empresa, autor: string): string | null {
  const partes: string[] = [];
  if (antes.nombre !== despues.nombre) partes.push(`el nombre de «${antes.nombre}» a «${despues.nombre}»`);
  if (antes.jurisdiccion !== despues.jurisdiccion) partes.push(`la jurisdicción de «${antes.jurisdiccion}» a «${despues.jurisdiccion}»`);
  if (antes.paises_operacion.join() !== despues.paises_operacion.join()) {
    partes.push(`los países de operación de ${nombrePaises(antes.paises_operacion)} a ${nombrePaises(despues.paises_operacion)}`);
  }
  if (partes.length === 0) return null;
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
  return `${autor} cambió ${lista}.`;
}
