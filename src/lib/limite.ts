// Límite de frecuencia por clave (usuario) con ventana deslizante, en memoria del proceso.
// Suficiente para un solo servicio en Railway; con varias réplicas habría que moverlo a la base.

export type Limitador = { permitir(clave: string): boolean };

export function crearLimitador({ maximo, ventanaMs, ahora = Date.now }: { maximo: number; ventanaMs: number; ahora?: () => number }): Limitador {
  const golpes = new Map<string, number[]>();
  return {
    permitir(clave) {
      const t = ahora();
      const recientes = (golpes.get(clave) ?? []).filter((x) => t - x < ventanaMs);
      if (recientes.length >= maximo) {
        golpes.set(clave, recientes);
        return false;
      }
      recientes.push(t);
      golpes.set(clave, recientes);
      return true;
    },
  };
}
