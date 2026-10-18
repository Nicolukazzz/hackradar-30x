/** Iniciales para un monograma (empresa o persona): «Nébula Studio Inc.» → «NS». */
export function iniciales(nombre: string): string {
  const palabras = nombre
    .replace(/\b(inc|s\.?a\.?s?|ltda|llc|spa)\b\.?/gi, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (palabras.slice(0, 2).map((p) => p[0]).join("") || "?").toUpperCase();
}
