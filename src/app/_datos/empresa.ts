import { cache } from "react";

import type { Empresa } from "@/dominio/tipos";
import { obtenerRepositorio } from "@/repositorio";

// Nombre y datos de la empresa para mostrar (#84). Excepción a la regla de `_datos` (pasar por `exigirMiembro`):
// el nombre de la empresa sale también en páginas públicas (/entrar, /unirse, /enviar) y no es un dato reservado.
// Si la base no responde, null: la página se muestra igual, sin nombre, en vez de caerse en el login.

export const obtenerEmpresa = cache(async (): Promise<Empresa | null> => {
  try {
    return await (await obtenerRepositorio()).empresa();
  } catch (e) {
    console.error("No se pudo leer la empresa", e);
    return null;
  }
});
