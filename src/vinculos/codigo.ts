// Código del proveedor (#85): 8 caracteres en base32 de Crockford (sin I, L, O ni U), mostrado como `XXXX-XXXX`.
// Sin dependencias de Node: lo usa también el navegador para generar y mostrar el código en «Crear enlace».

export const LARGO_CODIGO = 8;
const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Código nuevo con 40 bits aleatorios. `bytes` se inyecta en tests. */
export function generarCodigo(bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(LARGO_CODIGO))): string {
  return formatearCodigo(Array.from(bytes.subarray(0, LARGO_CODIGO), (b) => ALFABETO[b % 32]).join(""));
}

/**
 * Lo que escribe una persona → los 8 caracteres canónicos, o null. Ignora guiones, espacios y mayúsculas, y lee
 * O como 0 e I/L como 1 (así lo define Crockford: dictado por teléfono no falla).
 */
export function normalizarCodigo(texto: string): string | null {
  const limpio = texto.toUpperCase().replaceAll(/[\s-]/g, "").replaceAll("O", "0").replaceAll(/[IL]/g, "1");
  return limpio.length === LARGO_CODIGO && [...limpio].every((c) => ALFABETO.includes(c)) ? limpio : null;
}

/** `K7M2Q9XD` → `K7M2-Q9XD`. */
export function formatearCodigo(c: string): string {
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}
