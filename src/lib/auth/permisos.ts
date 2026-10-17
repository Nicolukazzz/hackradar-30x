// Sesión, roles y permisos, puros (sin red ni Supabase): la sesión llega ya verificada por `obtenerSesion()`.
// Issue #51: una cuenta entra al panel solo si es miembro de la empresa; su rol decide qué puede hacer.
// La identidad y el rol salen siempre de la sesión, nunca del body ni de la URL.

export const ROLES = ["admin", "aprobador", "tesoreria"] as const;
export type Rol = (typeof ROLES)[number];

export type Sesion = {
  usuario_id: string;
  correo: string;
  nombre: string;
  /** null = la cuenta existe pero no pertenece a la empresa: no ve nada hasta aceptar una invitación */
  rol: Rol | null;
  /** centavos USD; null = sin límite. Solo aplica a `aprobador` */
  limite_aprobacion_usd: number | null;
};

export type Permiso =
  | "ver" // panel, registro, subir y procesar facturas
  | "aprobar" // decidir sobre facturas escaladas (§10)
  | "editar_reglas" // guardar una versión nueva de las reglas
  | "administrar"; // equipo (invitar, roles) y reiniciar la demo

const PERMISOS: Record<Rol, readonly Permiso[]> = {
  admin: ["ver", "aprobar", "editar_reglas", "administrar"],
  aprobador: ["ver", "aprobar"],
  tesoreria: ["ver"],
};

export const NOMBRE_ROL: Record<Rol, string> = {
  admin: "Administrador",
  aprobador: "Aprobador",
  tesoreria: "Tesorería",
};

export const DESCRIPCION_ROL: Record<Rol, string> = {
  admin: "Ve todo, aprueba cualquier monto, cambia las reglas y administra el equipo.",
  aprobador: "Ve todo y aprueba o rechaza facturas escaladas, hasta su límite.",
  tesoreria: "Ve todo, sube y procesa facturas. No aprueba pagos ni cambia reglas.",
};

export function rolPuede(rol: Rol | null, permiso: Permiso): boolean {
  return rol !== null && PERMISOS[rol].includes(permiso);
}

export function puede(sesion: Sesion, permiso: Permiso): boolean {
  return rolPuede(sesion.rol, permiso);
}

export const MENSAJE_401 = "Inicia sesión para continuar.";
export const MENSAJE_403 = "No tienes permiso para esta acción.";
export const MENSAJE_SIN_EMPRESA = "Tu cuenta todavía no pertenece a la empresa. Pide a un administrador un enlace de invitación.";

const MENSAJE_PERMISO: Record<Permiso, string> = {
  ver: MENSAJE_SIN_EMPRESA,
  aprobar: "Tu rol no permite aprobar ni rechazar pagos. Pídeselo a un aprobador o a un administrador.",
  editar_reglas: "Solo un administrador puede cambiar las reglas de pago.",
  administrar: "Solo un administrador puede hacer esto.",
};

/** Para las pantallas: si la sesión puede hacer algo y, si no, el motivo para mostrar al lado del botón. */
export type PermisoUI = { ok: true } | { ok: false; motivo: string };

export function permisoPara(sesion: Sesion | null, permiso: Permiso): PermisoUI {
  if (!sesion) return { ok: false, motivo: MENSAJE_401 };
  return puede(sesion, permiso) ? { ok: true } : { ok: false, motivo: MENSAJE_PERMISO[permiso] };
}

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

/** 403 con un mensaje que dice qué falta (sin membresía, o rol sin ese permiso). */
export function exigirPermiso(sesion: Sesion, permiso: Permiso): Sesion {
  if (puede(sesion, permiso)) return sesion;
  throw new ErrorAuth(403, sesion.rol === null ? MENSAJE_SIN_EMPRESA : MENSAJE_PERMISO[permiso]);
}
