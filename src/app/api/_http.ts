// Utilidades de las rutas de §12: respuestas JSON, errores `{ error }` y validación con zod.
// Las rutas no tienen lógica de negocio: validan, llaman a src/servicios o src/aprobaciones y responden.

import { NextResponse } from "next/server";
import { z } from "zod";

import { ErrorDecision } from "@/aprobaciones/decidir";
import { ErrorEquipo } from "@/equipo/tipos";
import { ErrorVinculo } from "@/vinculos/tipos";
import { ErrorMoneda } from "@/servicios/moneda";
import { ErrorProveedor } from "@/servicios/proveedores";
import { ErrorReglas } from "@/servicios/reglas";
import { ErrorSubida } from "@/servicios/subida";

/** Respuesta JSON 200 (o el estado de `init`). */
export function ok<T>(datos: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(datos, init);
}

/** Respuesta `{ error }` con el estado dado. */
export function error(estado: number, mensaje: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error: mensaje, ...extra }, { status: estado });
}

/** JSON crudo del cuerpo. Lanza ErrorEntrada (400) si no es JSON. */
export async function json(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ErrorEntrada("El cuerpo debe ser JSON.");
  }
}

/** Valida con zod. Lanza ErrorEntrada (400) con un mensaje legible. */
export function validar<T>(esquema: z.ZodType<T>, datos: unknown): T {
  const r = esquema.safeParse(datos);
  if (!r.success) throw new ErrorEntrada(z.prettifyError(r.error));
  return r.data;
}

/** Cuerpo JSON validado con zod. */
export async function cuerpo<T>(req: Request, esquema: z.ZodType<T>): Promise<T> {
  return validar(esquema, await json(req));
}

/** Cuerpo inválido: se responde 400 con el mensaje de validación. */
export class ErrorEntrada extends Error {
  readonly estado = 400;
}

/** Traduce los errores conocidos a `{ error }` con su código; el resto, 500 sin detalles internos. */
export function manejar(e: unknown): NextResponse {
  if (e instanceof ErrorEntrada) return error(400, e.message);
  if (e instanceof ErrorDecision) return error(e.estado, e.message);
  if (e instanceof ErrorSubida) return error(e.estado, e.message);
  if (e instanceof ErrorEquipo) return error(e.estado, e.message);
  if (e instanceof ErrorVinculo) return error(e.estado, e.message);
  if (e instanceof ErrorProveedor) return error(e.estado, e.message);
  if (e instanceof ErrorMoneda) return error(e.estado, e.message);
  if (e instanceof ErrorReglas) return error(e.estado, e.message, e.reporte ? { reporte: e.reporte } : undefined);
  console.error(e);
  return error(500, "Error interno. Nada se pagó ni se registró a medias.");
}
