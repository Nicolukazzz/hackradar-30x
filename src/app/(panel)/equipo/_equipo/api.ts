import { aCentavos } from "@/dominio/dinero";

// Llamadas del navegador a /api/equipo (#51). Un error del servidor llega como { error } legible; un 502 del
// proxy o una página de error de Next no traen JSON: no mostrar "Unexpected token <".

export async function llamar<T>(url: string, metodo: "POST" | "PATCH" | "DELETE", cuerpo?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: metodo,
    headers: cuerpo === undefined ? undefined : { "content-type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const datos = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(datos.error ?? "No se pudo completar. Intenta de nuevo.");
  return datos;
}

/** "5.000" · "5000" · "5.000,50" → centavos. null si está vacío; NaN si no es un monto. */
export function usdACentavos(texto: string): number | null {
  const limpio = texto.replaceAll(/[\s$USD]/gi, "");
  if (!limpio) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpio)) return Number.NaN;
  return aCentavos(limpio.replaceAll(".", "").replace(",", "."));
}
