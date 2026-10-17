// Detector determinista de instrucciones dirigidas al agente (R10, §4.3). Sin LLM.
// Busca sobre el texto normalizado (sin tildes, minúsculas) y devuelve los fragmentos
// tal como aparecen en el original, para citarlos en la explicación y resaltarlos en la UI.

/** Patrones mínimos de §4.3 R10, sobre texto sin tildes y en minúsculas. */
export const PATRONES_INYECCION: readonly RegExp[] = [
  /nota para el sistema/,
  /sistema de pagos/,
  /ignora(?:r)? (?:las|todas) (?:las )?(?:reglas|instrucciones)/,
  /sin revision/,
  /ya (?:fue|esta) aprobad/,
  /aprobar automaticamente/,
  /procesar (?:sin|de inmediato)/,
  /ignore (?:previous|all) instructions/,
  /approved by/,
  /do not (?:review|escalate)/,
  /system:/,
  /assistant:/,
  /ignore as regras/,
  /pagamento aprovado/,
];

/** Marcas diacríticas, guion suave, espacios de ancho cero y BOM. */
const INVISIBLES = /[\p{Mn}\u00AD\u200B-\u200F\u2060-\u2064\uFEFF]/gu;

/** Texto normalizado + a qué posición del original corresponde cada carácter. */
function normalizarConMapa(texto: string): { normal: string; origen: number[] } {
  let normal = "";
  const origen: number[] = [];
  let i = 0;
  for (const ch of texto) {
    // Compatibilidad (NFKD: "ｓｙｓｔｅｍ" → "system") y sin tildes. Espacios, saltos de línea y el separador
    // de celdas del PDF (" | ") cuentan como un solo espacio; los caracteres invisibles se ignoran
    // (si no, "procesar\n sin", "pro\u00ADcesar" o "Procesar | sin revisión" esquivarían el patrón).
    let n = /[\s|]/.test(ch) ? " " : ch.normalize("NFKD").replace(INVISIBLES, "").toLowerCase();
    if (n === " " && normal.endsWith(" ")) n = "";
    for (let k = 0; k < n.length; k++) origen.push(i);
    normal += n;
    i += ch.length;
  }
  origen.push(texto.length);
  return { normal, origen };
}

/** Fragmentos sospechosos encontrados, sin repetir, en orden de aparición. Completa la palabra cortada ("aprobad" → "aprobado"). */
export function detectarInstrucciones(texto: string): string[] {
  const { normal, origen } = normalizarConMapa(texto);
  const hallazgos: { inicio: number; fragmento: string }[] = [];
  for (const patron of PATRONES_INYECCION) {
    for (const m of normal.matchAll(new RegExp(patron.source, "g"))) {
      let fin = m.index + m[0].length;
      while (fin < normal.length && /[\p{L}\p{N}]/u.test(normal[fin] ?? "")) fin++;
      const inicioOriginal = origen[m.index] ?? 0;
      const finOriginal = origen[fin] ?? texto.length;
      hallazgos.push({ inicio: inicioOriginal, fragmento: texto.slice(inicioOriginal, finOriginal) });
    }
  }
  hallazgos.sort((a, b) => a.inicio - b.inicio);
  const vistos = new Set<string>();
  return hallazgos
    .map((h) => h.fragmento)
    .filter((f) => {
      const clave = f.toLowerCase();
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    });
}
