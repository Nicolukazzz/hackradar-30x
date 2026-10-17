import { obtenerAlmacenEquipo } from "@/equipo";
import { cambiarMiembro, quitarMiembro } from "@/equipo/servicio";
import { auditar } from "@/lib/auth/auditoria";
import { conSesion } from "@/lib/auth/ruta";
import { relojSistema } from "@/lib/reloj-sistema";

import { json, manejar, ok } from "../../../_http";

type Ctx = RouteContext<"/api/equipo/miembros/[id]">;

/** PATCH /api/equipo/miembros/:id (#51): `{ rol, limite_aprobacion_usd? }`. 409 si la empresa se queda sin admin. */
export const PATCH = conSesion(
  async (req: Request, ctx: Ctx, sesion) => {
    try {
      const { id } = await ctx.params;
      const m = await cambiarMiembro(await obtenerAlmacenEquipo(), id, await json(req), relojSistema().ahora());
      auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/api/equipo/miembros", motivo: `rol de ${id} → ${m.rol}` });
      return ok(m);
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);

/** DELETE /api/equipo/miembros/:id (#51): saca a la persona de la empresa (su cuenta sigue existiendo, sin acceso). */
export const DELETE = conSesion(
  async (_req: Request, ctx: Ctx, sesion) => {
    try {
      const { id } = await ctx.params;
      await quitarMiembro(await obtenerAlmacenEquipo(), id);
      auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/api/equipo/miembros", motivo: `quitó a ${id}` });
      return ok({ quitado: true });
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);
