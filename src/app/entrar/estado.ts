// Estado del asistente de /entrar (los archivos "use server" solo pueden exportar funciones).
export type EstadoEntrar =
  | { paso: "correo"; error?: string }
  | { paso: "codigo"; correo: string; error?: string };

// Igual exista o no el correo (evita enumeración, issue #25).
export const AVISO_CODIGO_ENVIADO = "Si el correo está registrado, te enviamos un código de 6 dígitos.";

/**
 * Qué mostrar tras pedir el código. Un 4xx (p. ej. correo no registrado) se trata igual que un envío
 * correcto para no delatar qué correos existen; 429 y fallas del envío (5xx, red) sí se avisan, para que
 * nadie espere un código que no va a llegar.
 */
export function respuestaEnvio(error: { status?: number } | null, correo: string): EstadoEntrar {
  if (!error) return { paso: "codigo", correo };
  if (error.status === 429) return { paso: "correo", error: "Pediste muchos códigos seguidos. Espera un minuto e inténtalo de nuevo." };
  if (error.status !== undefined && error.status >= 400 && error.status < 500) return { paso: "codigo", correo };
  return { paso: "correo", error: "No pudimos enviar el código. Inténtalo de nuevo en un minuto." };
}
