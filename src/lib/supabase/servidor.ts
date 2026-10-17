import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { entornoPublico } from "@/lib/supabase/entorno";

/** Cliente con la sesión del usuario (cookies). Para server components, server actions y route handlers. */
export async function crearClienteServidor() {
  const almacen = await cookies(); // primero: marca la ruta como dinámica antes de exigir variables
  const { url, publishableKey } = entornoPublico();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll(porEscribir) {
        try {
          for (const { name, value, options } of porEscribir) almacen.set(name, value, options);
        } catch {
          // Desde un server component no se pueden escribir cookies; el proxy ya refrescó la sesión.
        }
      },
    },
  });
}
