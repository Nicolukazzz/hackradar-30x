// Equipo de la empresa (#51): miembros con rol e invitaciones para unirse. Hoy hay una sola empresa (Nébula,
// `data/empresa.json`), pero membresías e invitaciones ya llevan `empresa_id`.

import type { Rol } from "@/lib/auth/permisos";

export const EMPRESA_ID = "nebula";

export type Miembro = {
  usuario_id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  /** centavos USD; null = sin límite (solo aplica a `aprobador`) */
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

export type EstadoInvitacion = "activa" | "vencida" | "revocada" | "usada";

export type NuevaInvitacion = Omit<Invitacion, "id" | "usos" | "revocada_en" | "creada_en"> & { token_hash: string; creada_en: string };

/** Mismos códigos que `public.aceptar_invitacion` (migración 20261017073944). */
export type ResultadoAceptar = "aceptada" | "invalida" | "otro_correo" | "ya_miembro";

export class ErrorEquipo extends Error {
  constructor(
    readonly estado: 400 | 403 | 404 | 409,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorEquipo";
  }
}

export const MENSAJE_ULTIMO_ADMIN = "La empresa debe tener al menos un administrador. Nombra a otra persona administradora antes.";
