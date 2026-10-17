// Estado del asistente de /entrar y mensajes (los archivos "use server" solo pueden exportar funciones).
// Lógica pura: se prueba sin Supabase en tests/auth/entrar.test.ts.

export type Vista = "entrar" | "crear" | "confirmar" | "olvide" | "recuperar";

export type EstadoEntrar = {
  vista: Vista;
  /** correo escrito (se conserva tras un error) o al que se mandó el código (confirmar, recuperar) */
  correo?: string;
  /** nombre escrito al crear la cuenta (se conserva tras un error) */
  nombre?: string;
  error?: string;
  /** aviso no bloqueante, p. ej. "te reenviamos el código" */
  aviso?: string;
};

type ErrorSupabase = { status?: number; code?: string } | null;

export const MINIMO_CONTRASENA = 8;
const MAXIMO_BYTES_CONTRASENA = 72; // bcrypt ignora lo que pase de 72 bytes (UTF-8: una ñ ocupa 2)

/**
 * Tras pedir un código (crear cuenta, reenviar, olvidé mi contraseña). Un 4xx (p. ej. correo no registrado)
 * se trata igual que un envío correcto para no delatar qué correos existen; 429 y fallas del envío (5xx,
 * red) sí se avisan en la vista de origen, para que nadie espere un código que no va a llegar.
 */
export function respuestaEnvio(error: ErrorSupabase, siguiente: EstadoEntrar, origen: Vista = siguiente.vista): EstadoEntrar {
  if (!error) return siguiente;
  // En error se conserva el correo: desde "confirmar" el siguiente paso lo necesita, y en los formularios se ve.
  const conservar = siguiente.correo === undefined ? {} : { correo: siguiente.correo };
  if (error.status === 429) return { vista: origen, ...conservar, error: "Pediste muchos códigos seguidos. Espera un minuto e inténtalo de nuevo." };
  if (error.status !== undefined && error.status >= 400 && error.status < 500) return siguiente;
  return { vista: origen, ...conservar, error: "No pudimos enviar el código. Inténtalo de nuevo en un minuto." };
}

/** Error de Supabase Auth → frase para la persona. Nunca dice si un correo existe. */
export function mensajeDeError(error: { status?: number; code?: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "otp_expired":
    case "otp_disabled":
      return "Código incorrecto o vencido. Pide uno nuevo.";
    case "weak_password":
      return `La contraseña es muy débil: usa al menos ${MINIMO_CONTRASENA} caracteres.`;
    case "same_password":
      return "La contraseña nueva debe ser distinta de la anterior.";
  }
  if (error.status === 429) return "Demasiados intentos. Espera unos minutos.";
  return "No pudimos completar la acción. Inténtalo de nuevo.";
}

export function errorDeContrasena(contrasena: string): string | null {
  if (contrasena.length < MINIMO_CONTRASENA) return `La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres.`;
  if (new TextEncoder().encode(contrasena).length > MAXIMO_BYTES_CONTRASENA) return "La contraseña es demasiado larga: usa hasta 72 caracteres sin tildes ni emojis.";
  return null;
}
