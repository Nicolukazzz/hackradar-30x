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
  // Ampliación de #8 (docs/research/ap-herramientas-e-inyeccion.md)
  /nuevas instrucciones/g,
  /olvida(?:r)? (?:las |todas )?(?:las )?(?:reglas|instrucciones)/g,
  /pre aprobad[a-z]*/g,
  /no requiere (?:aprobacion|revision)/g,
  /marcar(?:la|lo)? como (?:pagad|aprobad)[a-z]*/g,
  /you are an? (?:ai|assistant|agent|language model)\b/g,
  /\bas an ai\b/g,
  /disregard (?:the |all )?(?:above|previous|prior)/g,
  // Acotados: "new instructions for delivery" o "auto approve" sueltos aparecen en facturas normales.
  /new instructions (?:follow|below|are|for (?:the|this) (?:agent|system|ai))|(?:follow|here are|these are) (?:the |these )?new instructions/g,
  /auto ?approve (?:this|the|it)\b/g,
  /without review/g,
  /(?:this|it|payment|invoice|transfer) (?:is |was |has been )?already approved/g,
  /mark (?:it |this )?as (?:paid|approved)/g,
  /sem revisao/g,
  /aprovar automaticamente/g,
  /ignore as instrucoes/g,
  // Intento de cerrar o abrir el bloque de datos del prompt del extractor (§8 paso 4).
  /< ?documento ?>/g,
];

/**
 * Caracteres del bloque Unicode Tags (U+E0000–U+E007F): invisibles para una persona, pero el modelo los lee como el
 * ASCII que codifican (U+E0041 = "A"). Se decodifican antes de escanear, y una tira de ellos fuera de una bandera
 * (🏴 + tags) cuenta como hallazgo aunque no diga nada conocido: en una factura no tienen ningún uso legítimo.
 */
const ES_TAG = (cp: number) => cp >= 0xe0000 && cp <= 0xe007f;
const BANDERA = 0x1f3f4;

function decodificarTag(c: string): string {
  const cp = c.codePointAt(0) ?? 0;
  if (!ES_TAG(cp)) return c;
  return cp >= 0xe0020 && cp <= 0xe007e ? String.fromCharCode(cp - 0xe0000) : "";
}

const CANCELAR_TAG = 0xe007f;

/**
 * Una bandera de subdivisión real (🏴 + "gbsct" + CANCEL TAG): 1–6 letras minúsculas o dígitos en Tags y termina en
 * CANCEL TAG. Cualquier otra cosa detrás de 🏴 es texto oculto: si no, un 🏴 visible tapaba cualquier instrucción invisible.
 */
function esBandera(tira: string): boolean {
  const cps = [...tira].map((c) => c.codePointAt(0) ?? 0);
  const cuerpo = cps.slice(0, -1);
  return (
    cps.at(-1) === CANCELAR_TAG &&
    cuerpo.length >= 1 &&
    cuerpo.length <= 6 &&
    cuerpo.every((cp) => (cp >= 0xe0061 && cp <= 0xe007a) || (cp >= 0xe0030 && cp <= 0xe0039))
  );
}

/**
 * Tiras de caracteres Tags con texto oculto: [inicio, fin) en el texto original. No cuentan las banderas reales
 * ni las tiras que no codifican nada legible (un LANGUAGE TAG o un CANCEL TAG sueltos que deja un extractor de PDF).
 */
function tirasOcultas(texto: string): [number, number][] {
  const tiras: [number, number][] = [];
  let pos = 0;
  let inicio = -1;
  let anterior = 0;
  let previo = 0;
  const cerrar = (fin: number) => {
    const tira = texto.slice(inicio, fin);
    const legible = [...tira].map(decodificarTag).join("").trim() !== "";
    if (legible && !(previo === BANDERA && esBandera(tira))) tiras.push([inicio, fin]);
    inicio = -1;
  };
  for (const c of texto) {
    const cp = c.codePointAt(0) ?? 0;
    if (ES_TAG(cp)) {
      if (inicio === -1) {
        inicio = pos;
        previo = anterior;
      }
    } else if (inicio !== -1) cerrar(pos);
    anterior = cp;
    pos += c.length;
  }
  if (inicio !== -1) cerrar(pos);
  return tiras;
}

export type Hallazgo = {
  /**
   * Texto como lo lee el modelo: el del documento, con los caracteres Tags invisibles decodificados a ASCII.
   * Si la instrucción venía en Tags, este texto NO aparece literal en el original (ver `inicio`/`fin` para ubicarlo).
   */
  fragmento: string;
  /** línea completa donde aparece (para mostrar contexto) */
  linea: string;
  /** posición en el texto original: [inicio, fin) */
  inicio: number;
  fin: number;
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
    const pieza = plegar(decodificarTag(c));
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
      fin: finOriginal,
    });
  }
  // Texto invisible (Unicode Tags): se informa la tira completa, aunque adentro coincida un patrón ("system:" + el
  // resto de la orden), salvo que un hallazgo ya la cubra entera. Los hallazgos de patrón contenidos en la tira se
  // reemplazan por ella: el resultado sigue sin solaparse y muestra la instrucción completa.
  for (const [ini, fin] of tirasOcultas(original)) {
    if (hallazgos.some((h) => h.inicio <= ini && h.fin >= fin)) continue;
    const decodificado = limpiar(original.slice(ini, fin)).trim();
    for (let i = hallazgos.length - 1; i >= 0; i--) {
      const h = hallazgos[i];
      if (h && h.inicio < fin && h.fin > ini) hallazgos.splice(i, 1);
    }
    hallazgos.push({ fragmento: `texto invisible: ${decodificado}`.slice(0, 120), linea: decodificado, inicio: ini, fin });
  }
  return hallazgos.sort((a, b) => a.inicio - b.inicio);
}

/** Texto para mostrar: los Tags decodificados (se ve lo que lee el modelo), sin otros invisibles, espacios colapsados. */
function limpiar(t: string): string {
  return [...t].map(decodificarTag).join("").replace(/\p{Cf}/gu, "").replace(/\s+/g, " ");
}
