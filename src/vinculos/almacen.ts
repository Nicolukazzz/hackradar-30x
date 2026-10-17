// Dónde viven los enlaces de proveedor. Supabase en la app (`supabase.ts`); memoria en tests y en desarrollo sin
// Supabase (`memoria.ts`).

import type { EnlaceConCodigo, EnlaceProveedor, NuevoEnlace } from "./tipos";

export interface AlmacenEnlaces {
  /** los más nuevos primero */
  listar(): Promise<EnlaceProveedor[]>;
  porId(id: string): Promise<EnlaceConCodigo | null>;
  porHash(token_hash: string): Promise<EnlaceConCodigo | null>;
  /** Lanza `ErrorCodigoRepetido` si otro enlace ya tiene ese código. */
  crear(nuevo: NuevoEnlace): Promise<EnlaceProveedor>;
  /** false si no existe o ya estaba revocado */
  revocar(id: string, ahora: string): Promise<boolean>;
  /** Código nuevo para un enlace no revocado: el anterior deja de servir y las sesiones abiertas se cierran. */
  cambiarCodigo(id: string, codigo_hash: string, ahora: string): Promise<boolean>;
  registrarAcceso(id: string, ahora: string): Promise<void>;
}
