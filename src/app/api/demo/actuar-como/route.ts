import { cookies } from "next/headers";
import { z } from "zod";

import { obtenerRepositorio } from "@/repositorio";

import { cuerpo, error, manejar, ok } from "../../_http";
import { COOKIE_ACTUAR_COMO, demoActiva } from "@/app/_datos/identidad";

/**
 * POST /api/demo/actuar-como { aprobador_id }: selector "Actuar como" de la demo sin login.
 * Se apaga cuando #25 agrega la sesión real (DEMO_LOGIN).
 */
export async function POST(req: Request) {
  try {
    if (!demoActiva()) return error(404, "Modo demo apagado (DEMO=1 para activarlo).");
    const { aprobador_id } = await cuerpo(req, z.strictObject({ aprobador_id: z.string().min(1) }));
    const { aprobadores } = await (await obtenerRepositorio()).datosComunes();
    const a = aprobadores.find((x) => x.id === aprobador_id);
    if (!a) return error(404, "Ese aprobador no existe.");
    (await cookies()).set(COOKIE_ACTUAR_COMO, a.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
    return ok({ aprobador: { id: a.id, nombre: a.nombre, rol: a.rol } });
  } catch (e) {
    return manejar(e);
  }
}
