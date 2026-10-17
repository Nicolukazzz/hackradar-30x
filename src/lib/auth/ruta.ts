import "server-only";

import { auditar } from "@/lib/auth/auditoria";
import { crearGuardia } from "@/lib/auth/guardia";
import { obtenerSesion } from "@/lib/auth/sesion";

/**
 * Envuelve un route handler: exige sesión y mismo origen en métodos que escriben.
 * `export const POST = conSesion(async (req, ctx, sesion) => …)`
 */
export const { conSesion } = crearGuardia({ obtenerSesion, auditar });
