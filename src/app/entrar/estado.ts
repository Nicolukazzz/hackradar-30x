// Estado del asistente de /entrar y mensajes (los archivos "use server" solo pueden exportar funciones).
// Lógica pura: se prueba sin Supabase en tests/auth/entrar.test.ts.

/** #81: ya no se crean cuentas aquí (las crea el admin, #80). Quedan entrar y recuperar la contraseña con código. */
export type Vista = "entrar" | "olvide" | "recuperar";

/** Estado del formulario de /entrar entre acciones del servidor. */
export type EstadoEntrar = {
  vista: Vista;
  /** correo escrito (se conserva tras un error) o al que se mandó el código (recuperar) */
  correo?: string;
  error?: string;
};

type ErrorSupabase = { status?: number; code?: string } | null;

/** Largo mínimo de una contraseña (también configurado en Supabase Auth). */
export const MINIMO_CONTRASENA = 8;
const MAXIMO_BYTES_CONTRASENA = 72; // bcrypt ignora lo que pase de 72 bytes (UTF-8: una ñ ocupa 2)

/**
 * Tras pedir un código (olvidé mi contraseña). Un 4xx (p. ej. correo no registrado)
 * se trata igual que un envío correcto para no delatar qué correos existen; 429 y fallas del envío (5xx,
 * red) sí se avisan en la vista de origen, para que nadie espere un código que no va a llegar.
 */
export function respuestaEnvio(error: ErrorSupabase, siguiente: EstadoEntrar, origen: Vista = siguiente.vista): EstadoEntrar {
  if (!error) return siguiente;
  // En error se conserva el correo: el siguiente paso lo necesita, y en los formularios se ve.
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

/** El código de 6 dígitos del formulario (`codigo`), o null si no tiene esa forma. */
export function codigoDe(formulario: FormData): string | null {
  const valor = formulario.get("codigo");
  const codigo = typeof valor === "string" ? valor.trim() : "";
  return /^\d{6}$/.test(codigo) ? codigo : null;
}

/** La contraseña no se recorta: un espacio al final es parte de ella. */
export function contrasenaDe(formulario: FormData): string {
  const valor = formulario.get("contrasena");
  return typeof valor === "string" ? valor : "";
}

export function errorDeContrasena(contrasena: string): string | null {
  if (contrasena.length < MINIMO_CONTRASENA) return `La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres.`;
  if (new TextEncoder().encode(contrasena).length > MAXIMO_BYTES_CONTRASENA) return "La contraseña es demasiado larga: usa hasta 72 caracteres sin tildes ni emojis.";
  return null;
}
