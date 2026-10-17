// Pantalla `/proveedores` (#85): portales de proveedor (mismos servicios que GET /api/proveedores/enlaces).
// Cualquier miembro ve la lista; crear, cambiar código y revocar es solo de administradores.

import { permisoPara, type PermisoUI } from "@/lib/auth/permisos";
import { relojSistema } from "@/lib/reloj-sistema";
import { obtenerAlmacenEnlaces } from "@/vinculos";
import { listarEnlaces, type EnlaceConEstado } from "@/vinculos/servicio";

import { exigirMiembro } from "./sesion";

export type { EnlaceConEstado } from "@/vinculos/servicio";

export async function obtenerProveedores(): Promise<{ enlaces: EnlaceConEstado[]; crear: PermisoUI }> {
  const sesion = await exigirMiembro();
  const enlaces = await listarEnlaces(await obtenerAlmacenEnlaces(), relojSistema().ahora());
  return { enlaces, crear: permisoPara(sesion, "administrar") };
}
