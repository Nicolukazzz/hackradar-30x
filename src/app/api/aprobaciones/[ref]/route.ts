import { z } from "zod";

import { decidir } from "@/aprobaciones/decidir";
import { puede } from "@/lib/auth/permisos";
import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { ahoraHumano } from "@/servicios/comun";

import { cuerpo, error, manejar, ok } from "../../_http";
import { cuentasFirmantes } from "../../_identidad";

// Estricto: un body con `aprobador_id` se rechaza (la identidad sale de la sesión, #25).
const Cuerpo = z.strictObject({
  accion: z.enum(["aprobar", "rechazar"]),
  comentario: z.string().max(1000),
  agregar_a_lista: z.boolean().optional(),
  vincular_canal: z.boolean().optional(),
});

/**
 * POST /api/aprobaciones/:ref (§10, §12): aprobar o rechazar una factura escalada. Devuelve la EntradaRegistro nueva.
 * Solo admin o aprobador (#51); `agregar_a_lista` solo admin. Las firmas válidas son las de los miembros que hoy pueden aprobar, con su límite.
 */
export const POST = conSesion(
  async (req: Request, ctx: RouteContext<"/api/aprobaciones/[ref]">, sesion) => {
    try {
      const { ref } = await ctx.params;
      const body = await cuerpo(req, Cuerpo);
      // Agregar a la lista permitida cambia las reglas (beneficiarios, §13.4): solo administradores.
      if (body.agregar_a_lista && !puede(sesion, "editar_reglas")) {
        return error(403, "Solo un administrador puede agregar beneficiarios a la lista permitida. Puedes aprobar sin agregarlo.");
      }
      if (body.vincular_canal && !puede(sesion, "editar_reglas")) {
        return error(403, "Solo un administrador puede vincular canales a un proveedor. Puedes aprobar sin vincularlo.");
      }
      const [repo, cuentas] = await Promise.all([obtenerRepositorio(), cuentasFirmantes()]);
      const r = await decidir({ ref, ...body, aprobador_id: sesion.usuario_id, cuentas }, { repo, ahora: await ahoraHumano(repo) });
      return ok(r.entrada, { status: 201 });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "aprobar" },
);
