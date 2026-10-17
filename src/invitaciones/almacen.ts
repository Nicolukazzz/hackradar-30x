// Dónde viven las invitaciones de proveedor. Supabase en la app (`supabase.ts`); memoria en tests y en desarrollo
// sin Supabase (`memoria.ts`).

import type { InvitacionProveedor, NuevaInvitacionProveedor, ResultadoUso } from "./tipos";

export interface AlmacenInvitaciones {
  /** las más nuevas primero */
  listar(): Promise<InvitacionProveedor[]>;
  porId(id: string): Promise<InvitacionProveedor | null>;
  porHash(token_hash: string): Promise<InvitacionProveedor | null>;
  crear(nueva: NuevaInvitacionProveedor): Promise<InvitacionProveedor>;
  /** false si no existe o ya estaba revocada */
  revocar(id: string, ahora: string): Promise<boolean>;
  /**
   * Atómico: valida (vigente, no revocada, con usos, correo esperado) y cuenta un uso. Dos envíos a la vez
   * nunca pasan del máximo. `correo` sale de la sesión verificada.
   */
  usar(token_hash: string, correo: string, ahora: string): Promise<{ resultado: ResultadoUso; invitacion: InvitacionProveedor | null }>;
}
