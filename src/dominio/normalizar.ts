// Normalización para comparar nombres, números de factura y textos.
// Misma lógica que scripts/dataset/oraculo.py (normalizar_nombre / normalizar_numero).

/** Sufijos societarios que no distinguen a un beneficiario, ya tokenizados. */
const SUFIJOS: readonly (readonly string[])[] = [
  ["S", "A", "DE", "C", "V"],
  ["S", "A", "S"],
  ["S", "A"],
  ["SPA"],
  ["LTDA"],
  ["INC"],
  ["LLC"],
];

/** Quita marcas diacríticas sin espacio (categoría Mn), igual que `sin_tildes` del oráculo Python. */
export function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Mn}/gu, "");
}

/** Minúsculas y sin tildes: para buscar palabras clave y patrones (R5, R10). */
export function normalizarTexto(texto: string): string {
  return sinTildes(texto).toLowerCase();
}

function terminaEn(tokens: string[], sufijo: readonly string[]): boolean {
  return tokens.length > sufijo.length && sufijo.every((t, i) => tokens[tokens.length - sufijo.length + i] === t);
}

/** "Servicios Ómicron S.A." → "SERVICIOS OMICRON" · "Pixel & Co." → "PIXEL CO" */
export function normalizarNombre(nombre: string): string {
  let tokens = sinTildes(nombre).toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const sufijo of SUFIJOS) {
      if (terminaEn(tokens, sufijo)) {
        tokens = tokens.slice(0, -sufijo.length);
        cambio = true;
      }
    }
  }
  return tokens.join(" ");
}

/** "INV 2210" → "INV-2210" · "fac_1041" → "FAC-1041" */
export function normalizarNumeroFactura(numero: string): string {
  return sinTildes(numero).toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean).join("-");
}

/** Identificador legible para urls e ids (`ben-mesa-legal`): sin tildes, minúsculas, guiones. */
export function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** NIT, RUT, RFC…: solo letras y dígitos en mayúscula ("900.123.456-7" = "9001234567"). */
export function normalizarIdentificacion(id: string): string {
  return id.replaceAll(/[^0-9A-Za-z]/g, "").toUpperCase();
}
