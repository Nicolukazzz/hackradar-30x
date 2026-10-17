import { createBrowserClient } from "@supabase/ssr";

import { entornoPublico } from "@/lib/supabase/entorno";

/** Cliente para client components (p. ej. realtime). La autorización nunca se decide aquí. */
export function crearClienteNavegador() {
  const { url, publishableKey } = entornoPublico();
  return createBrowserClient(url, publishableKey);
}
