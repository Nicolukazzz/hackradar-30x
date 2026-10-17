"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { errorDeContrasena, mensajeDeError, respuestaEnvio, type EstadoEntrar, type Vista } from "@/app/entrar/estado";
import { auditar } from "@/lib/auth/auditoria";
import { destinoTrasEntrar } from "@/lib/auth/rutas";
import { obtenerSesion } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Server actions de /entrar (#49, #81): iniciar sesión con contraseña y cambiar una contraseña olvidada con código.
// Las cuentas ya no se crean aquí: las crea un admin con «Crear empleado» (#80). Next verifica el Origin (CSRF).

const esquemaCorreo = z.email();
const esquemaCodigo = z.string().regex(/^\d{6}$/);

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
  // Solo cuentas creadas antes de #80 por el registro abierto, que nunca confirmaron su correo.
  if (error?.code === "email_not_confirmed") return { vista: "entrar", correo, error: "Tu correo no está confirmado. Pide a tu administrador que te cree la cuenta de nuevo." };
  if (error) return { vista: "entrar", correo, error: mensajeDeError(error) };
  return terminarEntrada(texto(formulario, "siguiente"), "entrar");
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
