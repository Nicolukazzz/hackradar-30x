import { z } from "zod";

import { decidir } from "@/aprobaciones/decidir";
import { obtenerAlmacenEquipo } from "@/equipo";
import { firmantes } from "@/equipo/servicio";
import { EMPRESA_ID } from "@/equipo/tipos";
import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { ahoraHumano } from "@/servicios/comun";

import { cuerpo, manejar, ok } from "../../_http";
import { aprobadorDeMiembro } from "../../_identidad";

// Estricto: un body con `aprobador_id` se rechaza (la identidad sale de la sesión, #25).
const Cuerpo = z.strictObject({
  accion: z.enum(["aprobar", "rechazar"]),
  comentario: z.string().max(1000),
  agregar_a_lista: z.boolean().optional(),
});

/**
 * POST /api/aprobaciones/:ref (§10, §12): aprobar o rechazar una factura escalada. Devuelve la EntradaRegistro nueva.
 * Solo admin o aprobador (#51). Las firmas válidas son las de los miembros que hoy pueden aprobar, con su límite.
 */
export const POST = conSesion(
  async (req: Request, ctx: RouteContext<"/api/aprobaciones/[ref]">, sesion) => {
    try {
      const { ref } = await ctx.params;
      const body = await cuerpo(req, Cuerpo);
      const [repo, almacen] = await Promise.all([obtenerRepositorio(), obtenerAlmacenEquipo()]);
      const cuentas = firmantes(await almacen.miembros(EMPRESA_ID)).map(aprobadorDeMiembro);
      const r = await decidir({ ref, ...body, aprobador_id: sesion.usuario_id, cuentas }, { repo, ahora: await ahoraHumano(repo) });
      return ok(r.entrada, { status: 201 });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "aprobar" },
);
