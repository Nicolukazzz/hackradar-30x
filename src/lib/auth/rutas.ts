import type { Rol } from "@/lib/auth/permisos";

// Qué hace el proxy con cada ruta. Chequeo optimista (¿hay sesión válida?); el rol se verifica
// después en el servidor con `obtenerSesion()` + `exigirRol()`.

/** Páginas que se ven sin sesión. */
export const PAGINAS_PUBLICAS = ["/entrar", "/sin-permiso"] as const;

/** Rutas de API sin sesión de usuario (webhooks de canales con su propia verificación). Vacío por ahora. */
export const API_PUBLICAS: readonly string[] = [];

export type DecisionRuta = "seguir" | "redirigir" | "no_autorizado";

function coincide(ruta: string, base: string): boolean {
  return ruta === base || ruta.startsWith(`${base}/`);
}

/** Inicio de cada rol tras entrar. */
export function inicioDe(rol: Rol): string {
  return rol === "proveedor" ? "/portal" : "/";
}

/**
 * Adónde ir tras entrar. `siguiente` viene de la URL: solo se acepta una ruta interna del mismo sitio
 * (evita redirecciones abiertas a `//malo.example` o `/\malo.example`) y que no sea /entrar.
 */
export function destinoTrasEntrar(siguiente: string | null | undefined, rol: Rol): string {
  if (!siguiente || !siguiente.startsWith("/") || siguiente.startsWith("//") || siguiente.includes("\\")) return inicioDe(rol);
  if (coincide(siguiente.split(/[?#]/)[0] ?? "", "/entrar")) return inicioDe(rol);
  return siguiente;
}

export function clasificarRuta(ruta: string, haySesion: boolean): DecisionRuta {
  if (haySesion) return "seguir";
  if (PAGINAS_PUBLICAS.some((p) => coincide(ruta, p))) return "seguir";
  if (coincide(ruta, "/api")) return API_PUBLICAS.some((p) => coincide(ruta, p)) ? "seguir" : "no_autorizado";
  return "redirigir";
}
