// Crea o actualiza usuarios de Supabase Auth y sus filas en public.perfiles (issue #25). Idempotente.
//
//   cp scripts/auth/usuarios.example.json scripts/auth/usuarios.json   # correos reales (ignorado por git)
//   npm run auth:sembrar [-- --archivo otra/ruta.json]
//
// Sin contraseñas: cada persona entra con el código de 6 dígitos que le llega al correo.
// Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY de .env o del entorno. La llave secreta salta
// RLS: este script nunca corre en el navegador ni en la app.

import { readFile } from "node:fs/promises";

import { createClient, type User } from "@supabase/supabase-js";
import { z } from "zod";

import { cargarDatosComunes } from "@/dominio/cargar";

const entorno = z
  .object({ NEXT_PUBLIC_SUPABASE_URL: z.url(), SUPABASE_SECRET_KEY: z.string().min(1) })
  .parse(process.env);

const esquemaUsuario = z
  .strictObject({
    correo: z.email().transform((c) => c.toLowerCase()),
    rol: z.enum(["tesoreria", "aprobador", "proveedor"]),
    aprobador_id: z.string().optional(),
    beneficiario_id: z.string().optional(),
    nombre: z.string().min(1).max(120),
  })
  .refine((u) => (u.rol === "aprobador") === Boolean(u.aprobador_id), "aprobador_id solo y siempre con rol aprobador")
  .refine((u) => (u.rol === "proveedor") === Boolean(u.beneficiario_id), "beneficiario_id solo y siempre con rol proveedor");

type UsuarioSemilla = z.infer<typeof esquemaUsuario>;

function argumento(nombre: string): string | null {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

const supabase = createClient(entorno.NEXT_PUBLIC_SUPABASE_URL, entorno.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function todosLosUsuarios(): Promise<User[]> {
  const usuarios: User[] = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw error;
    usuarios.push(...data.users);
    if (data.users.length < 200) return usuarios;
  }
}

async function sembrar(u: UsuarioSemilla, existentes: User[]) {
  const previo = existentes.find((e) => e.email?.toLowerCase() === u.correo);
  // El rol vive en perfiles; app_metadata solo como referencia visible en el dashboard (no autoriza).
  const atributos = { email_confirm: true, app_metadata: { rol: u.rol } };
  const { data, error } = previo
    ? await supabase.auth.admin.updateUserById(previo.id, atributos)
    : await supabase.auth.admin.createUser({ email: u.correo, ...atributos });
  if (error) throw new Error(`${u.correo}: ${error.message}`);

  const { error: errorPerfil } = await supabase.from("perfiles").upsert({
    id: data.user.id,
    rol: u.rol,
    aprobador_id: u.aprobador_id ?? null,
    beneficiario_id: u.beneficiario_id ?? null,
    nombre: u.nombre,
    activo: true,
  });
  if (errorPerfil) throw new Error(`perfil de ${u.correo}: ${errorPerfil.message}`);
  console.log(`${previo ? "actualizado" : "creado    "}  ${u.rol.padEnd(10)} ${u.nombre}`);
}

async function principal() {
  const archivo = argumento("--archivo") ?? "scripts/auth/usuarios.json";
  const usuarios = z.array(esquemaUsuario).parse(JSON.parse(await readFile(archivo, "utf8")));

  // Los ids deben existir en data/ (aprobadores.json, proveedores.json).
  const datos = await cargarDatosComunes();
  for (const u of usuarios) {
    if (u.aprobador_id && !datos.aprobadores.some((a) => a.id === u.aprobador_id)) throw new Error(`aprobador ${u.aprobador_id} no existe`);
    if (u.beneficiario_id && !datos.beneficiarios.some((b) => b.id === u.beneficiario_id)) throw new Error(`beneficiario ${u.beneficiario_id} no existe`);
  }

  const existentes = await todosLosUsuarios();
  for (const u of usuarios) await sembrar(u, existentes);
}

principal().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
