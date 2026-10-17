// Qué hace el proxy con cada ruta. Chequeo optimista (¿hay sesión válida?); la sesión se verifica
// de nuevo en el servidor con `obtenerSesion()` (layout del panel y `conSesion`).

/** Páginas que se ven sin sesión. */
export const PAGINAS_PUBLICAS = ["/entrar", "/sin-permiso"] as const;

/**
 * Rutas de API que no pasan por `conSesion` (verifican por su cuenta). `/api/enviar/<token>` (#28): quien sube no es
 * miembro de la empresa, pero la ruta exige sesión, mismo origen y un enlace de invitación válido.
 */
export const API_PUBLICAS: readonly string[] = ["/api/enviar"];
 * Rutas de API sin sesión de usuario (webhooks de canales con su propia verificación). Telegram (#13): cabecera
 * X-Telegram-Bot-Api-Secret-Token.
 */
export const API_PUBLICAS: readonly string[] = ["/api/canales/telegram/webhook"];

export type DecisionRuta = "seguir" | "redirigir" | "no_autorizado";

function coincide(ruta: string, base: string): boolean {
  return ruta === base || ruta.startsWith(`${base}/`);
}

/**
 * Adónde ir tras entrar. `siguiente` viene de la URL: solo se acepta una ruta interna del mismo sitio
 * (evita redirecciones abiertas a `//malo.example` o `/\malo.example`) y que no sea /entrar.
 */
export function destinoTrasEntrar(siguiente: string | null | undefined): string {
  if (!siguiente || !siguiente.startsWith("/") || siguiente.startsWith("//") || siguiente.includes("\\")) return "/";
  if (coincide(siguiente.split(/[?#]/)[0] ?? "", "/entrar")) return "/";
  return siguiente;
}

export function clasificarRuta(ruta: string, haySesion: boolean, apiPublicas: readonly string[] = API_PUBLICAS): DecisionRuta {
  if (haySesion) return "seguir";
  if (PAGINAS_PUBLICAS.some((p) => coincide(ruta, p))) return "seguir";
  // /api exige sesión salvo las rutas declaradas en API_PUBLICAS (webhooks que verifican por su cuenta;
  // el test de arquitectura usa la misma lista).
  if (coincide(ruta, "/api")) return apiPublicas.some((p) => coincide(ruta, p)) ? "seguir" : "no_autorizado";
  return "redirigir";
}
