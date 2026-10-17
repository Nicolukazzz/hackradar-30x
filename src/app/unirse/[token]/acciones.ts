"use server";

import { redirect } from "next/navigation";

import { obtenerAlmacenEquipo } from "@/equipo";
import { aceptar } from "@/equipo/servicio";
import { auditar } from "@/lib/auth/auditoria";
import { obtenerSesion } from "@/lib/auth/sesion";

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
