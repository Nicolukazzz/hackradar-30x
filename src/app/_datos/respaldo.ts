import "server-only";

import { unstable_rethrow } from "next/navigation";

// Datos secundarios de una pantalla (avisos, contadores, criterios): si fallan, la pantalla se muestra igual con un
// valor por defecto en vez de caerse entera. Redirecciones y not-found de Next (sin sesión, sin permiso) pasan igual.
export async function conRespaldo<T>(datos: Promise<T>, respaldo: T, que: string): Promise<T> {
  try {
    return await datos;
  } catch (e) {
    unstable_rethrow(e);
    console.error(`pantalla: no se pudo leer ${que}; se muestra sin eso:`, e instanceof Error ? e.message : e);
    return respaldo;
  }
}
