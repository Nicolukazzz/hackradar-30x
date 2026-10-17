// Dónde viven los enlaces de proveedor. Supabase en la app (`supabase.ts`); memoria en tests y en desarrollo sin
// Supabase (`memoria.ts`).

import type { EnlaceProveedor, NuevoEnlace } from "./tipos";

export interface AlmacenEnlaces {
  /** los más nuevos primero */
  listar(): Promise<EnlaceProveedor[]>;
  porHash(token_hash: string): Promise<EnlaceProveedor | null>;
  crear(nuevo: NuevoEnlace): Promise<EnlaceProveedor>;
  /** false si no existe, ya se usó o ya estaba revocado */
  revocar(id: string, ahora: string): Promise<boolean>;
  /** Atómico: si el enlace sigue activo lo marca usado con el correo y el id de conexión; si no, null. */
  usar(token_hash: string, correo: string, conexion_id: string, ahora: string): Promise<EnlaceProveedor | null>;
}
