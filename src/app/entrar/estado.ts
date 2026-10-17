// Estado del asistente de /entrar (los archivos "use server" solo pueden exportar funciones).
export type EstadoEntrar =
  | { paso: "correo"; error?: string }
  | { paso: "codigo"; correo: string; error?: string };

// Igual exista o no el correo (evita enumeración, issue #25).
export const AVISO_CODIGO_ENVIADO = "Si el correo está registrado, te enviamos un código de 6 dígitos.";
