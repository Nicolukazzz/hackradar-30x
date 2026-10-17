// Nombra administrador de la empresa a una cuenta ya creada en /entrar (#51). Sirve para el primer admin, que no
// tiene a nadie que lo invite, o para recuperar el acceso. Usa la llave secreta (.env): solo el equipo la tiene.
//   npm run equipo:admin -- persona@correo.com
import { createClient } from "@supabase/supabase-js";

import { EMPRESA_ID } from "../../src/equipo/tipos";

async function main() {
  const correo = process.argv[2]?.trim().toLowerCase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!correo) throw new Error("Uso: npm run equipo:admin -- persona@correo.com");
  if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en .env");
  const db = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });

  let usuario: { id: string; email?: string; email_confirmed_at?: string | null } | undefined;
  for (let page = 1; !usuario; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    usuario = data.users.find((u) => u.email?.toLowerCase() === correo);
    if (data.users.length < 1000) break;
  }
  if (!usuario) throw new Error(`No hay una cuenta con ${correo}. Primero créala en /entrar.`);
  if (!usuario.email_confirmed_at) throw new Error(`${correo} todavía no confirmó su correo con el código.`);

  const { error } = await db
    .from("membresias")
    .upsert({ empresa_id: EMPRESA_ID, usuario_id: usuario.id, rol: "admin", limite_aprobacion_usd: null }, { onConflict: "empresa_id,usuario_id" });
  if (error) throw new Error(`No se pudo guardar la membresía: ${error.message}`);
  console.log(`Listo: ${correo} es administrador de ${EMPRESA_ID}. Ya puede invitar al resto desde /equipo.`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
