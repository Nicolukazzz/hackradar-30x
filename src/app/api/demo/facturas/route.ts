import { z } from "zod";

import { dependenciasCanal } from "@/canales/dependencias";
import { crearLimitador } from "@/lib/limite";
import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { catalogoEjemplos, enviarEjemplo } from "@/servicios/facturas-ejemplo";

import { cuerpo, error, manejar, ok } from "../../_http";
import { demoActiva } from "../../_identidad";

// Facturas de ejemplo (#162). Solo administradores y solo en modo demo, como los `/simular` de los canales: quien envía
// elige a nombre de qué proveedor llega la factura, así que no puede estar abierto a cualquier cuenta.

// «Enviar todas» manda 30 seguidas: el tope deja hacerlo una vez por minuto sin abrir la puerta a un abuso.
const limitador = crearLimitador({ maximo: 45, ventanaMs: 60_000 });

const Cuerpo = z.strictObject({ archivo: z.string().min(1).max(120) });

/** GET /api/demo/facturas: catálogo de facturas de ejemplo con su resultado esperado. */
export const GET = conSesion(
  async () => {
    try {
      if (!demoActiva()) return error(404, "Modo demo apagado (DEMO=1 para activarlo).");
      return ok({ facturas: await catalogoEjemplos() });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);

/** POST /api/demo/facturas `{ archivo }`: la envía como su proveedor y devuelve `{ ref_interna, estado, mensaje, factura }`. */
export const POST = conSesion(
  async (req: Request, _ctx, sesion) => {
    try {
      if (!demoActiva()) return error(404, "Modo demo apagado (DEMO=1 para activarlo).");
      if (!limitador.permitir(sesion.usuario_id)) return error(429, "Demasiadas facturas seguidas. Espera un minuto.");
      const { archivo } = await cuerpo(req, Cuerpo);
      const r = await enviarEjemplo(archivo, sesion, await dependenciasCanal(await obtenerRepositorio()));
      return ok(r, { status: 201 });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);
