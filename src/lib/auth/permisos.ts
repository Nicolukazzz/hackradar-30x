import type { Aprobador } from "@/dominio/tipos";

// Permisos puros (sin red ni Supabase): la sesión llega ya verificada por `obtenerSesion()` (sesion.ts).
// Issue #25: la identidad sale siempre de la sesión, nunca del body ni de la URL.

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

function aprobadorDeSesion(sesion: Sesion | null, aprobadores: readonly Aprobador[]): Aprobador {
  const s = exigirRol(sesion, "aprobador");
  const aprobador = aprobadores.find((a) => a.id === s.aprobador_id);
  if (!aprobador) throw new ErrorAuth(403);
  return aprobador;
}

/** §10: el aprobador de la sesión debe tener límite para el monto (null = sin límite). */
export function exigirAprobadorPara(
  sesion: Sesion | null,
  monto_usd_centavos: number,
  aprobadores: readonly Aprobador[],
): Aprobador {
  const aprobador = aprobadorDeSesion(sesion, aprobadores);
  if (aprobador.limite_usd !== null && monto_usd_centavos > aprobador.limite_usd) {
    throw new ErrorAuth(403, "Supera tu límite de aprobación");
  }
  return aprobador;
}

/** Guardar una versión de reglas: solo el aprobador principal (Laura Méndez). */
export function exigirAprobadorPrincipal(sesion: Sesion | null, aprobadores: readonly Aprobador[]): Aprobador {
  const aprobador = aprobadorDeSesion(sesion, aprobadores);
  if (!aprobador.principal) throw new ErrorAuth(403);
  return aprobador;
}

/** Un proveedor solo ve documentos de su beneficiario; el equipo interno ve todos. */
export function puedeVerDocumento(sesion: Sesion | null, beneficiario_id: string | null): boolean {
  if (!sesion) return false;
  if (sesion.rol !== "proveedor") return true;
  return sesion.beneficiario_id !== null && sesion.beneficiario_id === beneficiario_id;
}
