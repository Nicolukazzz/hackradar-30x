"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { errorDeContrasena, mensajeDeError, respuestaEnvio, type EstadoEntrar, type Vista } from "@/app/entrar/estado";
import { auditar } from "@/lib/auth/auditoria";
import { destinoTrasEntrar } from "@/lib/auth/rutas";
import { obtenerSesion } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Server actions de /entrar (#49): crear cuenta, confirmar el correo con código, iniciar sesión con contraseña
// y cambiar una contraseña olvidada. Next verifica el Origin de cada server action (CSRF).

const esquemaCorreo = z.email();
const esquemaCodigo = z.string().regex(/^\d{6}$/);
const esquemaNombre = z.string().min(1).max(120);

function texto(formulario: FormData, campo: string): string {
  const valor = formulario.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

/** La contraseña no se recorta: un espacio al final es parte de ella. */
function contrasenaDe(formulario: FormData): string {
  const valor = formulario.get("contrasena");
  return typeof valor === "string" ? valor : "";
}

function correoDe(formulario: FormData): string | null {
  const r = esquemaCorreo.safeParse(texto(formulario, "correo").toLowerCase());
  return r.success ? r.data : null;
}

/** Despacha según el formulario que se envió (`accion`). */
export async function avanzar(previo: EstadoEntrar, formulario: FormData): Promise<EstadoEntrar> {
  switch (texto(formulario, "accion")) {
    case "iniciar":
      return iniciarSesion(formulario);
    case "crear":
      return crearCuenta(formulario);
    case "confirmar":
      return confirmarCuenta(formulario);
    case "reenviar":
      return reenviarCodigo(formulario);
    case "olvide":
      return pedirCambioDeContrasena(formulario);
    case "recuperar":
      return cambiarContrasena(formulario);
    default:
      return previo;
  }
}

async function iniciarSesion(formulario: FormData): Promise<EstadoEntrar> {
  const correo = correoDe(formulario);
  const contrasena = contrasenaDe(formulario);
  if (!correo || !contrasena) return { vista: "entrar", error: "Escribe tu correo y tu contraseña." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena });
  if (error?.code === "email_not_confirmed") {
    // La cuenta existe y la contraseña es correcta, pero falta confirmar el correo: se reenvía el código.
    const { error: errorEnvio } = await supabase.auth.resend({ type: "signup", email: correo });
    const siguiente: EstadoEntrar = { vista: "confirmar", correo, aviso: "Tu correo aún no está confirmado. Te enviamos un código nuevo." };
    return respuestaEnvio(errorEnvio, siguiente, "entrar");
  }
  if (error) return { vista: "entrar", correo, error: mensajeDeError(error) };
  return terminarEntrada(texto(formulario, "siguiente"), "entrar");
}

async function crearCuenta(formulario: FormData): Promise<EstadoEntrar> {
  const nombre = esquemaNombre.safeParse(texto(formulario, "nombre"));
  if (!nombre.success) return { vista: "crear", error: "Escribe tu nombre (hasta 120 caracteres)." };
  const correo = correoDe(formulario);
  if (!correo) return { vista: "crear", error: "Escribe un correo válido." };
  const contrasena = contrasenaDe(formulario);
  const problema = errorDeContrasena(contrasena);
  if (problema) return { vista: "crear", correo, nombre: nombre.data, error: problema };

  const supabase = await crearClienteServidor();
  // Si el correo ya tiene cuenta, Supabase responde igual y no envía nada: no se delata quién está registrado.
  const { error } = await supabase.auth.signUp({ email: correo, password: contrasena, options: { data: { nombre: nombre.data } } });
  if (error?.code === "weak_password") return { vista: "crear", correo, nombre: nombre.data, error: mensajeDeError(error) };
  const respuesta = respuestaEnvio(error, { vista: "confirmar", correo }, "crear");
  if (!respuesta.error) {
    auditar({ tipo: "registro", usuario_id: null, ruta: "/entrar" });
  } else if (error?.status !== 429) {
    auditar({ tipo: "error_envio", usuario_id: null, ruta: "/entrar", motivo: `${error?.status ?? "sin status"} ${error?.code ?? ""}`.trim() });
  }
  return respuesta;
}

async function confirmarCuenta(formulario: FormData): Promise<EstadoEntrar> {
  const correo = correoDe(formulario);
  if (!correo) return { vista: "crear", error: "Vuelve a escribir tu correo." };
  const codigo = esquemaCodigo.safeParse(texto(formulario, "codigo"));
  if (!codigo.success) return { vista: "confirmar", correo, error: "El código tiene 6 dígitos." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.verifyOtp({ email: correo, token: codigo.data, type: "email" });
  if (error) return { vista: "confirmar", correo, error: mensajeDeError({ status: error.status, code: error.code ?? "otp_expired" }) };
  return terminarEntrada(texto(formulario, "siguiente"), "confirmar");
}

async function reenviarCodigo(formulario: FormData): Promise<EstadoEntrar> {
  const correo = correoDe(formulario);
  if (!correo) return { vista: "crear", error: "Vuelve a escribir tu correo." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.resend({ type: "signup", email: correo });
  return respuestaEnvio(error, { vista: "confirmar", correo, aviso: "Te enviamos un código nuevo." }, "confirmar");
}

async function pedirCambioDeContrasena(formulario: FormData): Promise<EstadoEntrar> {
  const correo = correoDe(formulario);
  if (!correo) return { vista: "olvide", error: "Escribe un correo válido." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(correo);
  return respuestaEnvio(error, { vista: "recuperar", correo }, "olvide");
}

async function cambiarContrasena(formulario: FormData): Promise<EstadoEntrar> {
  const correo = correoDe(formulario);
  if (!correo) return { vista: "olvide", error: "Vuelve a escribir tu correo." };
  const codigo = esquemaCodigo.safeParse(texto(formulario, "codigo"));
  if (!codigo.success) return { vista: "recuperar", correo, error: "El código tiene 6 dígitos." };
  const contrasena = contrasenaDe(formulario);
  const problema = errorDeContrasena(contrasena);
  if (problema) return { vista: "recuperar", correo, error: problema };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.verifyOtp({ email: correo, token: codigo.data, type: "recovery" });
  if (error) return { vista: "recuperar", correo, error: mensajeDeError({ status: error.status, code: error.code ?? "otp_expired" }) };
  const { error: errorCambio } = await supabase.auth.updateUser({ password: contrasena });
  if (errorCambio) return { vista: "recuperar", correo, error: mensajeDeError(errorCambio) };
  return terminarEntrada(texto(formulario, "siguiente"), "recuperar");
}

export async function salir(): Promise<void> {
  const sesion = await obtenerSesion();
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  auditar({ tipo: "salir", usuario_id: sesion?.usuario_id ?? null, ruta: "/salir" });
  redirect("/entrar");
}

async function terminarEntrada(siguiente: string, vista: Vista): Promise<EstadoEntrar> {
  // Autenticada pero con la cuenta desactivada (perfiles.activo = false): fuera.
  const sesion = await obtenerSesion();
  if (!sesion) {
    const supabase = await crearClienteServidor();
    await supabase.auth.signOut();
    return { vista, error: "Tu cuenta está desactivada. Escribe al equipo para reactivarla." };
  }
  auditar({ tipo: "entrar", usuario_id: sesion.usuario_id, ruta: "/entrar" });
  redirect(destinoTrasEntrar(siguiente));
}
