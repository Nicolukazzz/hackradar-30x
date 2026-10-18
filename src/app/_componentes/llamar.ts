// Llamadas del navegador a la API del panel (/api/equipo #51, /api/empresa #84). Un error del servidor llega como
// { error } legible; un 502 del proxy o una página de error de Next no traen JSON: no mostrar "Unexpected token <".

export async function llamar<T>(url: string, metodo: "GET" | "POST" | "PATCH" | "DELETE", cuerpo?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: metodo,
    headers: cuerpo === undefined ? undefined : { "content-type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const datos = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(datos.error ?? "No se pudo completar. Intenta de nuevo.");
  return datos;
}
