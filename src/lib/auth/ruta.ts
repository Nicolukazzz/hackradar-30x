import "server-only";

import { auditar } from "@/lib/auth/auditoria";
import { crearGuardia } from "@/lib/auth/guardia";
import { obtenerSesion } from "@/lib/auth/sesion";

/**
 * Envuelve un route handler: exige sesión, rol y mismo origen en métodos que escriben.
 * `export const POST = conRol(["aprobador"], async (req, ctx, sesion) => …)`
 */
export const { conRol } = crearGuardia({ obtenerSesion, auditar });
