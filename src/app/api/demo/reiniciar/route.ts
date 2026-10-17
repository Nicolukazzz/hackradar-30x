import { conSesion } from "@/lib/auth/ruta";
import { reiniciarRepositorio } from "@/repositorio";

import { error, manejar, ok } from "../../_http";
import { demoActiva } from "../../_identidad";

/** POST /api/demo/reiniciar: vuelve al estado inicial del escenario (solo con REPOSITORIO=memoria). Solo administradores. */
export const POST = conSesion(async () => {
  try {
    if (!demoActiva()) return error(404, "Modo demo apagado (DEMO=1 para activarlo).");
    if ((process.env.REPOSITORIO ?? "memoria") !== "memoria") return error(409, "Solo se reinicia el repositorio en memoria.");
    await reiniciarRepositorio();
    return ok({ reiniciado: true });
  } catch (e) {
    return manejar(e);
  }
}, { permiso: "administrar" });
