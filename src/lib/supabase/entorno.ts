import { z } from "zod";

// Variables de Supabase. Se leen al primer uso (no al importar) para que `next build` y CI corran sin
// secretos; en runtime la app falla con un mensaje claro si faltan. Las NEXT_PUBLIC_ se escriben
// literales para que Next las incruste en el bundle del navegador.

const esquemaPublico = z.object({
  url: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL falta o no es una URL" }),
  publishableKey: z.string().min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY falta"),
});

export type EntornoPublico = z.infer<typeof esquemaPublico>;

export function entornoPublico(): EntornoPublico {
  const r = esquemaPublico.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!r.success) throw new Error(`Configuración de Supabase incompleta: ${r.error.issues.map((i) => i.message).join("; ")}`);
  return r.data;
}
