// Equipo de la empresa (#51): miembros con rol e invitaciones para unirse. Hoy hay una sola empresa (Nébula,
// `data/empresa.json`), pero membresías e invitaciones ya llevan `empresa_id`.

import type { Rol } from "@/lib/auth/permisos";

/** Id de la única empresa del hackathon. Membresías e invitaciones ya llevan `empresa_id` para crecer a varias. */
export const EMPRESA_ID = "nebula";

/** Persona del equipo con su rol en la empresa. */
export type Miembro = {
  usuario_id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  /** centavos en la moneda base; null = sin límite (solo aplica a `aprobador`) */
  limite_aprobacion_usd: number | null;
  /** false = la cuenta fue desactivada (perfiles.activo): no entra, no firma */
  activo: boolean;
  desde: string;
};

/** Lo que se muestra de una invitación. El token nunca se guarda: solo su hash. */
export type Invitacion = {
  id: string;
  rol: Rol;
  limite_aprobacion_usd: number | null;
  correo_esperado: string | null;
  creada_por: string | null;
  creada_en: string;
  expira_en: string;
  usos_max: number;
  usos: number;
  revocada_en: string | null;
};

/** Estado de una invitación al momento de mirarla. */
export type EstadoInvitacion = "activa" | "vencida" | "revocada" | "usada";

/** Invitación por crear: con el hash del token, nunca el token. */
export type NuevaInvitacion = Omit<Invitacion, "id" | "usos" | "revocada_en" | "creada_en"> & { token_hash: string; creada_en: string };

/** Mismos códigos que `public.aceptar_invitacion` (migración 20261017073944). */
export type ResultadoAceptar = "aceptada" | "invalida" | "otro_correo" | "ya_miembro";

/** Operación del equipo rechazada; `estado` es el código HTTP. */
export class ErrorEquipo extends Error {
  constructor(
    readonly estado: 400 | 403 | 404 | 409,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorEquipo";
  }
}

/** Mensaje cuando un cambio dejaría a la empresa sin administrador. */
export const MENSAJE_ULTIMO_ADMIN = "La empresa debe tener al menos un administrador. Nombra a otra persona administradora antes.";
