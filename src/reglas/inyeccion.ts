// Detector determinista de instrucciones dirigidas al agente (R10, especificación §4.3).
// Vive en reglas para que el motor no dependa del extractor: re-escanea el texto aunque
// la extracción no haya reportado nada (defensa en profundidad).

/** Patrones sobre texto sin tildes y en minúsculas. */
const PATRONES: readonly RegExp[] = [
  /nota para el sistema/g,
  /sistema de pagos/g,
  /ignora(?:r)? (?:las|todas) (?:las )?(?:reglas|instrucciones)/g,
  /sin revision/g,
  /ya (?:fue|esta) aprobad[a-z]*/g,
  /aprobar automaticamente/g,
  /procesar (?:sin [a-z]+|de inmediato)/g,
  /ignore (?:previous|all) instructions/g,
  /approved by/g,
  /do not (?:review|escalate)/g,
  /\bsystem:/g,
  /\bassistant:/g,
  /ignore as regras/g,
  /pagamento aprovado/g,
];

export type Hallazgo = {
  /** texto tal como aparece en el documento */
  fragmento: string;
  /** línea completa donde aparece (para mostrar contexto) */
  linea: string;
  inicio: number;
};

/** Letras de otros alfabetos que se ven iguales a las latinas (homoglifos más comunes). */
const HOMOGLIFOS: Record<string, string> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x", і: "i", ѕ: "s", ј: "j", к: "k", м: "m", т: "t", н: "h", в: "b",
  α: "a", ε: "e", ο: "o", ρ: "p", τ: "t", υ: "u", ι: "i", κ: "k", ν: "v",
};

/** Separadores que cuentan como espacio entre palabras ("sistema-de_pagos", "ignore.previous"). */
const SEPARADOR = /[\s_\-.,;·*/|~]/u;
/** Marcas combinantes y caracteres de formato (invisibles: ZWSP, ZWJ, soft hyphen, BOM, bidi…). */
const SIN_ANCHO = /[\p{Mn}\p{Me}\p{Cf}]/u;

/** Forma comparable de un carácter: NFKC (ancho completo, ligaduras), sin tildes ni invisibles, minúsculas, sin homoglifos. */
function plegar(c: string): string {
  let r = "";
  for (const x of c.normalize("NFKD")) {
    if (SIN_ANCHO.test(x)) continue;
    const m = x.toLowerCase().normalize("NFKC");
    for (const y of m) r += HOMOGLIFOS[y] ?? y;
  }
  return r;
}

/**
 * Hallazgos en orden de aparición, sin solaparse.
 * Se compara contra una versión plegada del texto (ver `plegar`; separadores colapsados a un espacio).
 * Cada carácter plegado guarda su posición en el original, así el fragmento se recorta del texto tal como llegó.
 */
export function detectarInstrucciones(texto: string): Hallazgo[] {
  const original = texto;
  let plano = "";
  const desde: number[] = [];
  const hasta: number[] = [];
  let pos = 0;
  const agregar = (pieza: string, inicio: number, fin: number) => {
    // Una entrada por unidad UTF-16 de la pieza: los índices de matchAll son en UTF-16.
    desde.push(...Array.from({ length: pieza.length }, () => inicio));
    hasta.push(...Array.from({ length: pieza.length }, () => fin));
    plano += pieza;
  };
  for (const c of original) {
    const inicio = pos;
    pos += c.length;
    const pieza = plegar(c);
    if (pieza === "") continue;
    if (SEPARADOR.test(pieza)) {
      if (plano.endsWith(" ")) hasta[hasta.length - 1] = pos;
      else agregar(" ", inicio, pos);
      continue;
    }
    agregar(pieza, inicio, pos);
  }

  const encontrados = PATRONES.flatMap((patron) => [...plano.matchAll(patron)].map((m) => ({ inicio: m.index, fin: m.index + m[0].length })));
  // Si dos patrones se pisan ("procesar sin revision" y "sin revision"), queda el que empieza antes y es más largo.
  encontrados.sort((a, b) => a.inicio - b.inicio || b.fin - a.fin);
  const hallazgos: Hallazgo[] = [];
  let ultimo = -1;
  for (const { inicio, fin } of encontrados) {
    if (inicio < ultimo) continue;
    ultimo = fin;
    const ini = desde[inicio] ?? 0;
    const finOriginal = hasta[fin - 1] ?? original.length;
    const iniLinea = original.lastIndexOf("\n", ini) + 1;
    const finLinea = original.indexOf("\n", finOriginal);
    hallazgos.push({
      fragmento: limpiar(original.slice(ini, finOriginal)),
      linea: limpiar(original.slice(iniLinea, finLinea === -1 ? undefined : finLinea)).trim(),
      inicio: ini,
    });
  }
  return hallazgos;
}

/** Texto para mostrar: sin invisibles y con espacios colapsados. */
function limpiar(t: string): string {
  return t.replace(/\p{Cf}/gu, "").replace(/\s+/g, " ");
}
