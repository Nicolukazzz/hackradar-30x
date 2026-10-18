// Tasas vigentes para el motor (#86): la foto del día; si no hay y la fuente responde, se toma y se guarda; si la
// fuente falla, la última foto. Sin ninguna, una tabla vacía: solo se convierte la moneda base y el resto escala (R1).
// El motor nunca llama a la red: recibe la tabla que sale de aquí.

import type { Moneda } from "@/dominio/tipos";

import type { AlmacenTasas, FotoTasas, FuenteTasas, TasasVigentes } from "./tipos";

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

/** Almacén en memoria (tests y demo local). */
export function almacenTasasMemoria(fotos: FotoTasas[] = []): AlmacenTasas {
  return {
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
