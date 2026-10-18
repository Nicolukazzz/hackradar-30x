// Puerta de las pantallas del panel (#51). El layout de (panel) ya redirige a quien no es miembro, pero Next no
// vuelve a renderizar un layout compartido en las navegaciones del cliente: una petición RSC de la página sola
// se lo salta. Por eso cada función de `_datos` pasa por aquí antes de leer nada. Página nueva del panel =
// sus datos por `_datos` (o llamar a `exigirMiembro` en la página).

import { redirect } from "next/navigation";

import { puede, type Permiso, type Sesion } from "@/lib/auth/permisos";
import { obtenerSesion } from "@/lib/auth/sesion";

/** Sesión de quien mira, o redirige: sin sesión a /entrar, sin el permiso a /sin-permiso. */
export async function exigirMiembro(permiso: Permiso = "ver"): Promise<Sesion> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/entrar");
  if (!puede(sesion, permiso)) redirect("/sin-permiso");
  return sesion;
}
