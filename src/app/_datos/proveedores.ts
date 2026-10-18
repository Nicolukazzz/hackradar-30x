// Pantalla `/proveedores` (#85): portales de proveedor (mismos servicios que GET /api/proveedores/enlaces).
// Cualquier miembro ve la lista; crear, cambiar código y revocar es solo de administradores.

import type { Beneficiario } from "@/dominio/tipos";
import { permisoPara, type PermisoUI } from "@/lib/auth/permisos";
import { relojSistema } from "@/lib/reloj-sistema";
import { obtenerRepositorio } from "@/repositorio";
import { listarProveedores } from "@/servicios/proveedores";
import { obtenerAlmacenEnlaces } from "@/vinculos";
import { listarEnlaces, type EnlaceConEstado } from "@/vinculos/servicio";

import { exigirMiembro } from "./sesion";

export type { EnlaceConEstado } from "@/vinculos/servicio";

/** Lista permitida, accesos al portal y si quien mira puede crear o cambiar (solo admin). */
export async function obtenerProveedores(): Promise<{ proveedores: Beneficiario[]; enlaces: EnlaceConEstado[]; crear: PermisoUI }> {
  const sesion = await exigirMiembro();
  const [proveedores, enlaces] = await Promise.all([
    listarProveedores(await obtenerRepositorio()),
    obtenerAlmacenEnlaces().then((a) => listarEnlaces(a, relojSistema().ahora())),
  ]);
  return { proveedores, enlaces, crear: permisoPara(sesion, "administrar") };
}
