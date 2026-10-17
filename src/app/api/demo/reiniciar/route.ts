import { conSesion } from "@/lib/auth/ruta";
import { reiniciarRepositorio } from "@/repositorio";

import { error, manejar, ok } from "../../_http";
import { demoActiva } from "../../_identidad";

/**
 * POST /api/demo/reiniciar (#76): empieza una corrida nueva de la demo, como recién sembrada. Nada se borra: con
 * Supabase las corridas anteriores quedan en la base. Solo administradores y solo con modo demo.
 */
export const POST = conSesion(async (_req, _ctx, sesion) => {
  try {
    if (!demoActiva()) return error(404, "Modo demo apagado (DEMO=1 para activarlo).");
    await reiniciarRepositorio(sesion.correo || sesion.usuario_id);
    return ok({ reiniciado: true });
  } catch (e) {
    return manejar(e);
  }
}, { permiso: "administrar" });
