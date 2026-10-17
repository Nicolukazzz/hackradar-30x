import { cookies } from "next/headers";

import { mismoOrigen } from "@/lib/auth/guardia";
import { crearLimitador } from "@/lib/limite";
import { relojSistema } from "@/lib/reloj-sistema";
import { obtenerAlmacenEnlaces } from "@/vinculos";
import { COOKIE_PROVEEDOR, crearValorSesion } from "@/vinculos/acceso";
import { entrar } from "@/vinculos/servicio";

import { error, json, manejar, ok } from "../../_http";

// POST /api/vincular/:token (#85): `{ correo, codigo }`. Si los dos coinciden con lo que puso el admin, deja la cookie
// de sesión del proveedor (2 h, solo para este enlace) y responde `{ ok: true }`; la pantalla pasa a «Ingrese sus
// facturas». DELETE cierra la sesión. Está en API_PUBLICAS: el proveedor no tiene cuenta. Mismo origen y tope de
// intentos por IP y por enlace (el código tiene 40 bits; con 5 intentos por minuto adivinarlo no es viable).

const porIp = crearLimitador({ maximo: 10, ventanaMs: 60_000 });
const porEnlace = crearLimitador({ maximo: 5, ventanaMs: 60_000 });

export async function POST(req: Request, ctx: RouteContext<"/api/vincular/[token]">): Promise<Response> {
  if (!mismoOrigen(req)) return error(403, "Origen no permitido.");
  const { token } = await ctx.params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!porIp.permitir(ip) || !porEnlace.permitir(token)) return error(429, "Demasiados intentos. Espera un minuto.");
  try {
    const ahora = relojSistema().ahora();
    const enlace = await entrar(await obtenerAlmacenEnlaces(), token, await json(req), ahora);
    const { valor, vence } = crearValorSesion(enlace.id, enlace.codigo_hash, ahora);
    (await cookies()).set(COOKIE_PROVEEDOR, valor, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: vence });
    return ok({ ok: true });
  } catch (e) {
    return manejar(e);
  }
}

export async function DELETE(req: Request): Promise<Response> {
  if (!mismoOrigen(req)) return error(403, "Origen no permitido.");
  (await cookies()).delete(COOKIE_PROVEEDOR);
  return ok({ ok: true });
}
