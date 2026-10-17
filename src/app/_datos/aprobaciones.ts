import { z } from "zod";

import { DineroSchema, IdReglaSchema, MomentoSchema } from "@/dominio/esquemas";

import mock from "../_mock/aprobaciones.json";

// Única puerta de las pantallas a `GET /api/aprobaciones` (§12). Hoy lee el mock; cuando #17
// publique la API, solo cambia `obtenerAprobaciones()`. La respuesta se valida con zod como todo
// lo que entra por disco o HTTP: un campo renombrado falla aquí con un mensaje claro, no en un render.
//
// Después de aprobar o rechazar (6c/6d), llamar `router.refresh()` (o `revalidatePath("/", "layout")`
// en una Server Action) para que el badge de la barra lateral se actualice: el layout no se vuelve
// a montar en navegaciones del cliente.

/** Propuesta (no está en §3): campos de EntradaRegistro §9 + asignado_a y responder_antes_de de ResultadoMotor. #17 y 6d la fijan. */
export const TarjetaAprobacionSchema = z.strictObject({
  ref_interna: z.string().min(1),
  factura_numero: z.string().nullable(),
  canal: z.enum(["portal", "correo", "telegram", "carga_manual"]),
  recibido_en: MomentoSchema,
  beneficiario: z.string().nullable(),
  monto_original: DineroSchema.nullable(),
  monto_usd_centavos: z.int().nonnegative().nullable(),
  reglas_que_fallaron: z.array(IdReglaSchema),
  comparaciones: z.array(z.string()),
  explicacion: z.string(),
  asignado_a: z.string().nullable(),
  responder_antes_de: MomentoSchema.nullable(),
});

export const RespuestaAprobacionesSchema = z.strictObject({
  pendientes: z.array(TarjetaAprobacionSchema),
  reservado_usd: z.int().nonnegative(),
});

export type TarjetaAprobacion = z.infer<typeof TarjetaAprobacionSchema>;
export type RespuestaAprobaciones = z.infer<typeof RespuestaAprobacionesSchema>;

export async function obtenerAprobaciones(): Promise<RespuestaAprobaciones> {
  return RespuestaAprobacionesSchema.parse(mock);
}

/** Conteo para el badge de Aprobaciones. Si la API falla, la barra lateral se muestra sin badge. */
export async function contarPendientes(): Promise<number | null> {
  try {
    return (await obtenerAprobaciones()).pendientes.length;
  } catch {
    return null;
  }
}
