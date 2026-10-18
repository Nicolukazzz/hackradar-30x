// Límite de frecuencia por clave (usuario) con ventana deslizante, en memoria del proceso.
// Suficiente para un solo servicio en Railway; con varias réplicas habría que moverlo a la base.

export type Limitador = { permitir(clave: string): boolean };

/**
 * Limitador de frecuencia: `permitir(clave)` acepta hasta `maximo` usos por `ventanaMs`. `ahora` se inyecta en tests.
 */
export function crearLimitador({ maximo, ventanaMs, ahora = Date.now }: { maximo: number; ventanaMs: number; ahora?: () => number }): Limitador {
  const golpes = new Map<string, number[]>();
  return {
    permitir(clave) {
      const t = ahora();
      const recientes = (golpes.get(clave) ?? []).filter((x) => t - x < ventanaMs);
      // Limpieza de claves vencidas cada tanto: el mapa no crece con cada usuario que alguna vez subió algo.
      if (golpes.size > 1000) for (const [k, v] of golpes) if (v.every((x) => t - x >= ventanaMs)) golpes.delete(k);
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
