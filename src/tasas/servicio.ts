// Tasas vigentes para el motor (#86): la foto del día; si no hay y la fuente responde, se toma y se guarda; si la
// fuente falla, la última foto. Sin ninguna, una tabla vacía: solo se convierte la moneda base y el resto escala (R1).
// El motor nunca llama a la red: recibe la tabla que sale de aquí.

import type { Moneda, TablaTasas } from "@/dominio/tipos";

import type { AlmacenTasas, FotoTasas, FuenteHistorica, FuenteTasas, TasasVigentes } from "./tipos";

export type DepsTasas = { almacen: AlmacenTasas; fuente: FuenteTasas; alFallar?: (e: unknown) => void };

const tabla = (foto: FotoTasas, periodo: string) => ({ periodo, base: foto.base, tasas: { ...foto.tasas } });

/** `hoy` = AAAA-MM-DD en la zona de la empresa. La tabla se publica para el periodo (mes) de hoy. */
export async function tasasVigentes(base: Moneda, hoy: string, deps: DepsTasas): Promise<TasasVigentes> {
  const periodo = hoy.slice(0, 7);
  const delDia = await deps.almacen.delDia(base, hoy);
  if (delDia) return { tabla: tabla(delDia, periodo), fecha: delDia.fecha, fuente: delDia.fuente, estado: "hoy" };
  try {
    const nueva = { ...(await deps.fuente.obtener(base)), fecha: hoy };
    await deps.almacen.guardar(nueva);
    return { tabla: tabla(nueva, periodo), fecha: hoy, fuente: nueva.fuente, estado: "hoy" };
  } catch (e) {
    deps.alFallar?.(e);
    const ultima = await deps.almacen.ultima(base, hoy);
    if (ultima) return { tabla: tabla(ultima, periodo), fecha: ultima.fecha, fuente: ultima.fuente, estado: "anterior" };
    return { tabla: { periodo, base, tasas: {} }, fecha: null, fuente: null, estado: "ninguna" };
  }
}

/**
 * #86: antes de decidir, que exista la foto de la fecha de emisión de la factura. Si no está guardada, se pide a la fuente
 * histórica y se guarda. Si la fuente falla, no pasa nada: el motor usará la foto anterior más cercana (o la de hoy).
 */
export async function asegurarFoto(base: Moneda, fecha: string, deps: { almacen: AlmacenTasas; historica: FuenteHistorica; alFallar?: (e: unknown) => void }): Promise<void> {
  if (await deps.almacen.delDia(base, fecha)) return;
  try {
    await deps.almacen.guardar({ ...(await deps.historica.obtenerEn(base, fecha)), fecha });
  } catch (e) {
    deps.alFallar?.(e);
  }
}

/** Fotos → tablas por fecha para el motor (`DatosComunes.tasas_diarias`). */
export function tablasPorFecha(fotos: readonly FotoTasas[]): Record<string, TablaTasas> {
  return Object.fromEntries(fotos.map((f) => [f.fecha, { periodo: f.fecha, base: f.base, tasas: { ...f.tasas } }]));
}

/** Almacén en memoria (tests y demo local). */
export function almacenTasasMemoria(fotos: FotoTasas[] = []): AlmacenTasas {
  return {
    async todas(base) {
      return fotos.filter((f) => f.base === base);
    },
    async delDia(base, fecha) {
      return fotos.find((f) => f.base === base && f.fecha === fecha) ?? null;
    },
    async ultima(base, hasta) {
      return fotos.filter((f) => f.base === base && f.fecha <= hasta).sort((a, b) => b.fecha.localeCompare(a.fecha))[0] ?? null;
    },
    async guardar(foto) {
      const i = fotos.findIndex((f) => f.base === foto.base && f.fecha === foto.fecha);
      if (i >= 0) fotos[i] = foto;
      else fotos.push(foto);
    },
  };
}
