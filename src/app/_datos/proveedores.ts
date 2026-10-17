// Pantalla `/proveedores` (#85): enlaces para vincular el correo de facturación de un proveedor (mismos servicios que
// GET /api/proveedores/enlaces). Cualquier miembro ve la lista; crear y revocar es solo de administradores.

import { permisoPara, type PermisoUI } from "@/lib/auth/permisos";
import { relojSistema } from "@/lib/reloj-sistema";
import { obtenerRepositorio } from "@/repositorio";
import { obtenerAlmacenEnlaces } from "@/vinculos";
import { listarEnlaces, type EnlaceConEstado } from "@/vinculos/servicio";

import { exigirMiembro } from "./sesion";

export type { EnlaceConEstado } from "@/vinculos/servicio";

export type OpcionBeneficiario = { id: string; nombre: string; correos: number };

export async function obtenerProveedores(): Promise<{ enlaces: EnlaceConEstado[]; beneficiarios: OpcionBeneficiario[]; crear: PermisoUI }> {
  const sesion = await exigirMiembro();
  const [enlaces, datos] = await Promise.all([
    obtenerAlmacenEnlaces().then((a) => listarEnlaces(a, relojSistema().ahora())),
    obtenerRepositorio().then((r) => r.datosComunes()),
  ]);
  const beneficiarios = datos.beneficiarios
    .filter((b) => b.estado === "activo")
    .map((b) => ({ id: b.id, nombre: b.nombre, correos: b.canales.correos.length }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return { enlaces, beneficiarios, crear: permisoPara(sesion, "administrar") };
}
