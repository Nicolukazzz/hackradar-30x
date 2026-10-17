"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { errorDeContrasena } from "@/app/entrar/estado";
import { obtenerAlmacenEquipo } from "@/equipo";
import { aceptar, vistaInvitacion } from "@/equipo/servicio";
import { hashToken } from "@/equipo/token";
import { auditar } from "@/lib/auth/auditoria";
import { obtenerSesion } from "@/lib/auth/sesion";
import { relojSistema } from "@/lib/reloj-sistema";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Aceptar una invitación (#51). La cuenta sale de la sesión (y su correo, de la sesión verificada); el token, del
// enlace. Next verifica el Origin de cada server action (CSRF).
export async function unirme(token: string): Promise<void> {
  const sesion = await obtenerSesion();
  const aqui = `/unirse/${encodeURIComponent(token)}`;
  if (!sesion) redirect(`/entrar?siguiente=${encodeURIComponent(aqui)}`);
  const resultado = await aceptar(await obtenerAlmacenEquipo(), token, sesion);
  auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/unirse", motivo: `invitación ${resultado}` });
  if (resultado === "aceptada") redirect("/");
  redirect(`${aqui}?resultado=${resultado}`);
}

export type EstadoCrearCuenta = { error?: string; nombre?: string };

const esquemaNombre = z.string().trim().min(1).max(120);

/**
 * Crear la cuenta desde el enlace del correo (#80). Quien llega aquí abrió el enlace que se envió a `correo_esperado`:
 * eso prueba que es dueño del correo, así que la cuenta se crea ya confirmada (admin API) y entra con la invitación
 * aceptada de forma atómica. El correo no se pide en el formulario: sale de la invitación.
 */
export async function crearCuentaYUnirme(token: string, _previo: EstadoCrearCuenta, formulario: FormData): Promise<EstadoCrearCuenta> {
  const nombre = esquemaNombre.safeParse(formulario.get("nombre"));
  const contrasena = typeof formulario.get("contrasena") === "string" ? (formulario.get("contrasena") as string) : "";
  if (!nombre.success) return { error: "Escribe tu nombre (hasta 120 caracteres)." };
  const problema = errorDeContrasena(contrasena);
  if (problema) return { error: problema, nombre: nombre.data };

  const almacen = await obtenerAlmacenEquipo();
  const vista = await vistaInvitacion(almacen, token, relojSistema().ahora());
  const correo = vista?.correo_esperado;
  if (!vista || !correo) return { error: "Este enlace ya no sirve: venció, se usó o lo revocaron. Pide uno nuevo a tu administrador." };

  const { data, error } = await crearClienteAdmin().auth.admin.createUser({ email: correo, password: contrasena, email_confirm: true, user_metadata: { nombre: nombre.data } });
  if (error || !data.user) {
    const existe = error?.code === "email_exists" || /already/i.test(error?.message ?? "");
    return {
      nombre: nombre.data,
      error: existe ? "Ya hay una cuenta con este correo: inicia sesión y vuelve a abrir el enlace." : "No se pudo crear la cuenta. Intenta de nuevo en un momento.",
    };
  }

  const supabase = await crearClienteServidor();
  const entrada = await supabase.auth.signInWithPassword({ email: correo, password: contrasena });
  if (entrada.error) return { error: "La cuenta se creó, pero no se pudo iniciar sesión. Entra con tu correo y tu contraseña." };
  const resultado = await almacen.aceptarInvitacion(hashToken(token), data.user.id, correo);
  auditar({ tipo: "equipo", usuario_id: data.user.id, ruta: "/unirse", motivo: `cuenta creada por invitación: ${resultado}` });
  if (resultado !== "aceptada") return { error: "La cuenta se creó, pero el enlace ya no sirve. Pide a tu administrador que te agregue." };
  redirect("/");
}
