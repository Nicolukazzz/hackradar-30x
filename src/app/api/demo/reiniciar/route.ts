import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio, reiniciarRepositorio } from "@/repositorio";

import { error, manejar, ok } from "../../_http";
import { demoActiva } from "../../_identidad";

/**
 * POST /api/demo/reiniciar (#76): empieza una corrida nueva de la demo, como recién sembrada. Nada se borra: con
 * Supabase las corridas anteriores quedan en la base. Solo administradores y solo con modo demo.
 */
export const POST = conSesion(async (_req, _ctx, sesion) => {
  try {
    if (!demoActiva()) return error(404, "Modo demo apagado (DEMO=1 para activarlo).");
    // Producción sin datos de ejemplo (#106): no hay escenario que volver a sembrar.
    if (!(await (await obtenerRepositorio()).escenario())) return error(409, "No hay demo: esta instalación no usa datos de ejemplo.");
    await reiniciarRepositorio(sesion.correo || sesion.usuario_id);
    return ok({ reiniciado: true });
  } catch (e) {
    return manejar(e);
  }
}, { permiso: "administrar" });
