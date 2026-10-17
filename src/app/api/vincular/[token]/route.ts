import { mismoOrigen } from "@/lib/auth/guardia";
import { crearLimitador } from "@/lib/limite";
import { relojSistema } from "@/lib/reloj-sistema";
import { obtenerRepositorio } from "@/repositorio";
import { obtenerAlmacenEnlaces } from "@/vinculos";
import { usarEnlace } from "@/vinculos/servicio";

import { error, json, manejar, ok } from "../../_http";

// POST /api/vincular/:token (#85): `{ correo }` → `{ nombre, existente, correo, conexion_id }`. Está en API_PUBLICAS:
// quien la llama es un proveedor sin cuenta. La autoriza el token del enlace (32 bytes, un solo uso, 7 días), creado
// por un administrador. Mismo origen (la página /vincular) y un tope de intentos por IP.

const porIp = crearLimitador({ maximo: 10, ventanaMs: 60_000 });

export async function POST(req: Request, ctx: RouteContext<"/api/vincular/[token]">): Promise<Response> {
  if (!mismoOrigen(req)) return error(403, "Origen no permitido.");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!porIp.permitir(ip)) return error(429, "Demasiados intentos. Espera un minuto.");
  try {
    const { token } = await ctx.params;
    return ok(await usarEnlace(await obtenerAlmacenEnlaces(), await obtenerRepositorio(), token, await json(req), relojSistema().ahora()));
  } catch (e) {
    return manejar(e);
  }
}
