// Permisos puros (sin red ni Supabase): la sesión llega ya verificada por `obtenerSesion()` (sesion.ts).
// Issue #25: la identidad sale siempre de la sesión, nunca del body ni de la URL. Aquí solo el rol;
// los límites del aprobador (§10), "solo el principal guarda reglas" y "cada proveedor ve lo suyo"
// viven en el dominio (decidir.ts, servicios/reglas.ts) y en sus rutas, con sus tests.

export type Rol = "tesoreria" | "aprobador" | "proveedor";

export type Sesion = {
  usuario_id: string;
  correo: string;
  rol: Rol;
  aprobador_id: string | null; // solo rol aprobador (id de data/aprobadores.json)
  beneficiario_id: string | null; // solo rol proveedor (id de data/proveedores.json)
  nombre: string;
};

export class ErrorAuth extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string = status === 401 ? MENSAJE_401 : MENSAJE_403,
  ) {
    super(message);
    this.name = "ErrorAuth";
  }
}

export const MENSAJE_401 = "Inicia sesión para continuar.";
export const MENSAJE_403 = "No tienes permiso para esta acción.";

export function exigirRol(sesion: Sesion | null, ...roles: Rol[]): Sesion {
  if (!sesion) throw new ErrorAuth(401);
  if (!roles.includes(sesion.rol)) throw new ErrorAuth(403);
  return sesion;
}
