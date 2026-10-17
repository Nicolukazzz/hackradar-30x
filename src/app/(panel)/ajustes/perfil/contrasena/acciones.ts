"use server";

import { exigirMiembro } from "@/app/_datos/sesion";
import { codigoDe, contrasenaDe, errorDeContrasena, mensajeDeError } from "@/app/entrar/estado";
import { auditar } from "@/lib/auth/auditoria";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Cambiar la contraseña desde Ajustes (#82): primero un código al correo de la cuenta, después el código + la contraseña
// nueva. Con la sesión abierta no basta: el código prueba que quien está frente a la pantalla también tiene el correo.
// Se usa el código de recuperación (resetPasswordForEmail + verifyOtp «recovery»), que el servidor de Supabase valida
// siempre: el nonce de reauthenticate() se ignora si «secure password change» está apagado o la sesión es reciente.
// Misma puerta que la pantalla (exigirMiembro). Next verifica el Origin de cada server action (CSRF).

export type ResultadoCodigo = { ok: true } | { ok: false; error: string };
/** `codigo_usado`: el código ya se gastó (verifyOtp pasó pero la contraseña no se guardó): hay que pedir otro. */
export type EstadoCambio = { listo?: boolean; error?: string; codigo_usado?: boolean };

export async function enviarCodigoSeguridad(): Promise<ResultadoCodigo> {
  const sesion = await exigirMiembro();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(sesion.correo);
  if (error) {
    if (error.status === 429) return { ok: false, error: "Pediste muchos códigos seguidos. Espera un minuto e inténtalo de nuevo." };
    auditar({ tipo: "error_envio", usuario_id: sesion.usuario_id, ruta: "/ajustes/perfil/contrasena", motivo: `${error.status ?? "sin status"} ${error.code ?? ""}`.trim() });
    return { ok: false, error: "No pudimos enviar el código. Inténtalo de nuevo en un minuto." };
  }
  return { ok: true };
}

export async function cambiarContrasena(_previo: EstadoCambio, formulario: FormData): Promise<EstadoCambio> {
  const sesion = await exigirMiembro();
  const codigo = codigoDe(formulario);
  if (!codigo) return { error: "El código tiene 6 dígitos." };
  const contrasena = contrasenaDe(formulario);
  // Todo lo que se puede revisar sin Supabase va antes de verifyOtp, que gasta el código.
  const problema = errorDeContrasena(contrasena);
  if (problema) return { error: problema };

  const supabase = await crearClienteServidor();
  // El código es del correo de la sesión, nunca de uno escrito en el formulario.
  const verificado = await supabase.auth.verifyOtp({ email: sesion.correo, token: codigo, type: "recovery" });
  if (verificado.error) return { error: mensajeDeError({ status: verificado.error.status, code: verificado.error.code ?? "otp_expired" }) };
  const { error } = await supabase.auth.updateUser({ password: contrasena });
  if (error) return { error: mensajeDeError({ status: error.status, code: error.code }), codigo_usado: true };
  auditar({ tipo: "contrasena", usuario_id: sesion.usuario_id, ruta: "/ajustes/perfil/contrasena" });
  return { listo: true };
}
