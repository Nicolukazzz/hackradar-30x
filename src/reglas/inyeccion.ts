// Detector determinista de instrucciones dirigidas al agente (R10, especificación §4.3).
// Vive en reglas para que el motor no dependa del extractor: re-escanea el texto aunque
// la extracción no haya reportado nada (defensa en profundidad).

import { normalizarTexto } from "@/dominio/normalizar";

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

/** Caracteres invisibles que se usan para partir palabras sin que se note. */
const INVISIBLES = /[\u00AD\u200B-\u200D\u2060\uFEFF]/;

/**
 * Hallazgos en orden de aparición, sin solaparse.
 * Se compara contra una versión plana del texto (sin tildes, minúsculas, sin caracteres invisibles y con
 * cualquier espacio, salto de línea o NBSP colapsado a un espacio) que guarda, para cada carácter,
 * su posición en el original: así el fragmento se recorta del texto tal como llegó.
 */
export function detectarInstrucciones(texto: string): Hallazgo[] {
  const original = texto.normalize("NFC");
  let plano = "";
  const desde: number[] = [];
  const hasta: number[] = [];
  let pos = 0;
  for (const c of original) {
    const inicio = pos;
    pos += c.length;
    if (INVISIBLES.test(c)) continue;
    if (/\s/.test(c)) {
      if (plano.endsWith(" ")) {
        hasta[hasta.length - 1] = pos;
        continue;
      }
      plano += " ";
      desde.push(inicio);
      hasta.push(pos);
      continue;
    }
    const n = normalizarTexto(c);
    const pieza = n.length === c.length ? n : c;
    for (let k = 0; k < pieza.length; k++) {
      desde.push(inicio);
      hasta.push(pos);
    }
    plano += pieza;
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
      fragmento: original.slice(ini, finOriginal).replace(INVISIBLES_TODOS, "").replace(/\s+/g, " "),
      linea: original.slice(iniLinea, finLinea === -1 ? undefined : finLinea).replace(INVISIBLES_TODOS, "").replace(/\s+/g, " ").trim(),
      inicio: ini,
    });
  }
  return hallazgos;
}

const INVISIBLES_TODOS = new RegExp(INVISIBLES.source, "g");
