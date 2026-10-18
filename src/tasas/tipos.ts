// Tasas del día (#86): tipos compartidos por la fuente, el almacén y el servicio.

import type { Moneda, TablaTasas } from "@/dominio/tipos";

/** Una foto de tasas: 1 {base} = X {moneda}, decimales en texto (como TablaTasas). */
export type FotoTasas = { fecha: string; base: Moneda; tasas: Partial<Record<Moneda, string>>; fuente: string };

/** De dónde salen las tasas. Intercambiable: hoy open.er-api.com (sin llave). */
export interface FuenteTasas {
  nombre: string;
  obtener(base: Moneda): Promise<Omit<FotoTasas, "fecha">>;
}

/** Dónde se guardan las fotos (Supabase `tasas_dia` o memoria en tests). */
export interface AlmacenTasas {
  delDia(base: Moneda, fecha: string): Promise<FotoTasas | null>;
  /** la más reciente con fecha ≤ `hasta` */
  ultima(base: Moneda, hasta: string): Promise<FotoTasas | null>;
  guardar(foto: FotoTasas): Promise<void>;
}

/** Qué tabla usó el agente y por qué (para la pantalla de Moneda y tasas). */
export type TasasVigentes = {
  tabla: TablaTasas;
  /** fecha de la foto usada; null si no hay ninguna */
  fecha: string | null;
  fuente: string | null;
  /** hoy: foto del día · anterior: la fuente falló y se usa la última · ninguna: solo se convierte la moneda base */
  estado: "hoy" | "anterior" | "ninguna";
};
