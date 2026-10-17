import { aCentavos } from "@/dominio/dinero";

export { llamar } from "@/app/_componentes/llamar";

/** "5.000" · "5000" · "5.000,50" → centavos. null si está vacío; NaN si no es un monto. */
export function usdACentavos(texto: string): number | null {
  const limpio = texto.replaceAll(/[\s$USD]/gi, "");
  if (!limpio) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpio)) return Number.NaN;
  return aCentavos(limpio.replaceAll(".", "").replace(",", "."));
}
