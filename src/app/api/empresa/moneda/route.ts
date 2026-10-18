import { z } from "zod";

import { MonedaSchema } from "@/dominio/esquemas";
import { obtenerAlmacenEquipo } from "@/equipo";
import { auditar } from "@/lib/auth/auditoria";
import { conSesion } from "@/lib/auth/ruta";
import { relojSistema } from "@/lib/reloj-sistema";
import { obtenerRepositorio } from "@/repositorio";
import { cambiarMonedaBase, vistaPreviaMoneda } from "@/servicios/moneda";

import { cuerpo, error, manejar, ok } from "../../_http";
import { aprobadorDeLaCuenta } from "../../_identidad";

/** GET /api/empresa/moneda?a=COP (#86): vista previa de cambiar la moneda base (límites convertidos con la tasa del día). */
export const GET = conSesion(
  async (req: Request) => {
    try {
      const a = MonedaSchema.safeParse(new URL(req.url).searchParams.get("a"));
      if (!a.success) return error(400, "Elige una moneda válida.");
      const [repo, equipo] = await Promise.all([obtenerRepositorio(), obtenerAlmacenEquipo()]);
      return ok(await vistaPreviaMoneda(repo, equipo, a.data));
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);

/** POST /api/empresa/moneda (#86): `{ moneda }` → cambia la moneda base, guarda las reglas convertidas y lo registra. */
export const POST = conSesion(
  async (req: Request, _ctx, sesion) => {
    try {
      const { moneda } = await cuerpo(req, z.strictObject({ moneda: MonedaSchema }));
      const [repo, equipo] = await Promise.all([obtenerRepositorio(), obtenerAlmacenEquipo()]);
      const r = await cambiarMonedaBase(repo, equipo, moneda, aprobadorDeLaCuenta(sesion), relojSistema().ahora());
      auditar({ tipo: "equipo", usuario_id: sesion.usuario_id, ruta: "/api/empresa/moneda", motivo: `moneda base → ${moneda}` });
      return ok(r);
    } catch (e) {
      return manejar(e);
    }
  },
  { permiso: "administrar" },
);
