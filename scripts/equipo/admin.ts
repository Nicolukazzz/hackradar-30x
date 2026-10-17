// Nombra administrador de la empresa a una cuenta (#51). Sirve para el primer admin, que no tiene a nadie que lo cree,
// o para recuperar el acceso. Desde #81 no hay registro público: si la cuenta no existe, se crea ya confirmada con la
// contraseña que se pasa. Usa la llave secreta (.env): solo el equipo la tiene.
//   npm run equipo:admin -- persona@correo.com [contraseña]
import { createClient } from "@supabase/supabase-js";

import { EMPRESA_ID } from "../../src/equipo/tipos";

async function main() {
  const correo = process.argv[2]?.trim().toLowerCase();
  const contrasena = process.argv[3];
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
  if (!usuario) {
    if (!contrasena || contrasena.length < 8) throw new Error(`No hay una cuenta con ${correo}. Para crearla: npm run equipo:admin -- ${correo} <contraseña de 8+ caracteres>`);
    const { data, error } = await db.auth.admin.createUser({ email: correo, password: contrasena, email_confirm: true, user_metadata: { nombre: correo.split("@")[0] } });
    if (error || !data.user) throw new Error(`No se pudo crear la cuenta: ${error?.message ?? "sin usuario"}`);
    usuario = data.user;
    console.log(`Cuenta creada para ${correo}.`);
  } else if (!usuario.email_confirmed_at) {
    const { error } = await db.auth.admin.updateUserById(usuario.id, { email_confirm: true });
    if (error) throw new Error(`No se pudo confirmar el correo: ${error.message}`);
  }

  const { error } = await db
    .from("membresias")
    .upsert({ empresa_id: EMPRESA_ID, usuario_id: usuario.id, rol: "admin", limite_aprobacion_usd: null }, { onConflict: "empresa_id,usuario_id" });
  if (error) throw new Error(`No se pudo guardar la membresía: ${error.message}`);
  console.log(`Listo: ${correo} es administrador de ${EMPRESA_ID}. Ya puede crear al resto del equipo desde Ajustes → Equipo.`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
