// Dónde viven miembros e invitaciones. Supabase en la app (`supabase.ts`); memoria en los tests (`memoria.ts`).
// Siempre de una empresa (`empresa_id`): ninguna operación cruza empresas.

import type { Rol } from "@/lib/auth/permisos";

import type { Invitacion, Miembro, NuevaInvitacion, ResultadoAceptar } from "./tipos";

export interface AlmacenEquipo {
  miembros(empresa_id: string): Promise<Miembro[]>;
  /** Las más nuevas primero: todas las que siguen vigentes (sin tope, para poder revocarlas) + las 50 más recientes. */
  invitaciones(empresa_id: string, ahora: string): Promise<Invitacion[]>;
  invitacionPorHash(empresa_id: string, token_hash: string): Promise<Invitacion | null>;
  crearInvitacion(empresa_id: string, nueva: NuevaInvitacion): Promise<Invitacion>;
  /** false si no existe o ya estaba revocada */
  revocarInvitacion(empresa_id: string, id: string, ahora: string): Promise<boolean>;
  /** Atómico: valida, crea la membresía y cuenta el uso. `correo` sale de la sesión verificada. */
  aceptarInvitacion(token_hash: string, usuario_id: string, correo: string): Promise<ResultadoAceptar>;
  /** Lanza ErrorEquipo 409 si dejaría a la empresa sin admin. */
  cambiarMiembro(empresa_id: string, usuario_id: string, rol: Rol, limite_aprobacion_usd: number | null, ahora: string): Promise<void>;
  /** Lanza ErrorEquipo 409 si dejaría a la empresa sin admin. */
  quitarMiembro(empresa_id: string, usuario_id: string): Promise<void>;
}
