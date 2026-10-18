// Datos de aprobaciones para las pantallas (Server Components). Usan el mismo servicio que
// `GET /api/aprobaciones` (§12), así la UI y la API nunca dan respuestas distintas, sin que un
// Server Component tenga que pedirse HTTP a sí mismo.
//
// Después de aprobar o rechazar (6c/6d), llamar `router.refresh()` para que el badge de la barra
// lateral se actualice: el layout no se vuelve a montar en navegaciones del cliente.

import { proveedoresPorConfirmar, type ProveedorPorConfirmar } from "@/aprobaciones/proveedores-nuevos";
import { remitentesPorConfirmar, type RemitentePorConfirmar } from "@/aprobaciones/remitentes";
import { permisoPara, type PermisoUI } from "@/lib/auth/permisos";
import { obtenerRepositorio } from "@/repositorio";
import { obtenerAprobaciones as servicio, type OrdenAprobaciones, type RespuestaAprobaciones } from "@/servicios/aprobaciones";

import { exigirMiembro } from "./sesion";

export type { RespuestaAprobaciones, TarjetaAprobacion } from "@/servicios/aprobaciones";

export async function obtenerAprobaciones(orden?: OrdenAprobaciones): Promise<RespuestaAprobaciones> {
  await exigirMiembro();
  return servicio(await obtenerRepositorio(), orden);
}

/** Conteo para el badge de Aprobaciones. Si algo falla, la barra lateral se muestra sin badge. */
export async function contarPendientes(): Promise<number | null> {
  try {
    return (await obtenerAprobaciones()).pendientes.length;
  } catch {
    return null;
  }
}

/** Por confirmar (2026-10-18): remitentes nuevos y proveedores nuevos, y si quien mira puede responder (es de administrador). */
export async function obtenerPorConfirmar(): Promise<{ remitentes: RemitentePorConfirmar[]; proveedores: ProveedorPorConfirmar[]; confirmar: PermisoUI }> {
  const sesion = await exigirMiembro();
  const repo = await obtenerRepositorio();
  const [remitentes, proveedores] = await Promise.all([remitentesPorConfirmar(repo), proveedoresPorConfirmar(repo)]);
  return { remitentes, proveedores, confirmar: permisoPara(sesion, "editar_reglas") };
}
