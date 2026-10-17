// Sesión y error de acceso, puros (sin red ni Supabase): la sesión llega ya verificada por `obtenerSesion()`.
// Issue #49: no hay roles; toda cuenta confirmada entra a todo. La identidad sale siempre de la sesión,
// nunca del body ni de la URL.

export type Sesion = {
  usuario_id: string;
  correo: string;
  nombre: string;
};

export const MENSAJE_401 = "Inicia sesión para continuar.";
export const MENSAJE_403 = "No tienes permiso para esta acción.";

export class ErrorAuth extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string = status === 401 ? MENSAJE_401 : MENSAJE_403,
  ) {
    super(message);
    this.name = "ErrorAuth";
  }
}

export function exigirSesion(sesion: Sesion | null): Sesion {
  if (!sesion) throw new ErrorAuth(401);
  return sesion;
}
