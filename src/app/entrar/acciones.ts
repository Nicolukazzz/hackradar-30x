"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import type { EstadoEntrar } from "@/app/entrar/estado";
import { auditar } from "@/lib/auth/auditoria";
import { obtenerSesion } from "@/lib/auth/sesion";
import { destinoTrasEntrar } from "@/lib/auth/rutas";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Server actions de /entrar. Next verifica el Origin de cada server action (CSRF).

const esquemaCorreo = z.email();
const esquemaCodigo = z.string().regex(/^\d{6}$/);

function texto(formulario: FormData, campo: string): string {
  const valor = formulario.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

export async function pedirCodigo(_previo: EstadoEntrar, formulario: FormData): Promise<EstadoEntrar> {
  const correo = esquemaCorreo.safeParse(texto(formulario, "correo").toLowerCase());
  if (!correo.success) return { paso: "correo", error: "Escribe un correo válido." };

  const supabase = await crearClienteServidor();
  // shouldCreateUser: false → nadie crea cuentas desde /entrar; un correo desconocido falla en silencio.
  const { error } = await supabase.auth.signInWithOtp({ email: correo.data, options: { shouldCreateUser: false } });
  if (error?.status === 429) {
    return { paso: "correo", error: "Pediste muchos códigos seguidos. Espera un minuto e inténtalo de nuevo." };
  }
  return { paso: "codigo", correo: correo.data };
}

export async function verificarCodigo(_previo: EstadoEntrar, formulario: FormData): Promise<EstadoEntrar> {
  const correo = esquemaCorreo.safeParse(texto(formulario, "correo").toLowerCase());
  if (!correo.success) return { paso: "correo", error: "Vuelve a escribir tu correo." };
  const codigo = esquemaCodigo.safeParse(texto(formulario, "codigo"));
  if (!codigo.success) return { paso: "codigo", correo: correo.data, error: "El código tiene 6 dígitos." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.verifyOtp({ email: correo.data, token: codigo.data, type: "email" });
  if (error) {
    const mensaje = error.status === 429 ? "Demasiados intentos. Espera unos minutos." : "Código incorrecto o vencido. Pide uno nuevo si pasaron 10 minutos.";
    return { paso: "codigo", correo: correo.data, error: mensaje };
  }
  return terminarEntrada(texto(formulario, "siguiente"));
}

export async function salir(): Promise<void> {
  const sesion = await obtenerSesion();
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  auditar({ tipo: "salir", usuario_id: sesion?.usuario_id ?? null, ruta: "/salir" });
  redirect("/entrar");
}

async function terminarEntrada(siguiente: string): Promise<never> {
  // Usuario autenticado pero sin perfil activo: fuera.
  const sesion = await obtenerSesion();
  if (!sesion) {
    const supabase = await crearClienteServidor();
    await supabase.auth.signOut();
    redirect("/sin-permiso");
  }
  auditar({ tipo: "entrar", usuario_id: sesion.usuario_id, ruta: "/entrar" });
  redirect(destinoTrasEntrar(siguiente, sesion.rol));
}
