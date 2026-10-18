import { z } from "zod";

import { crearTokenVinculo } from "@/canales/telegram/vinculo";
import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { ahoraHumano } from "@/servicios/comun";

import { cuerpo, error, manejar, ok } from "../../../_http";

const Cuerpo = z.strictObject({ beneficiario_id: z.string().min(1).max(80) });

/**
 * POST /api/canales/telegram/enlace (#13): `{ beneficiario_id }` → `{ enlace }` = `https://t.me/<bot>?start=<token>`
 * firmado, de un solo uso, vence en 72 h. La empresa se lo manda al proveedor por un medio que ya conoce; al abrirlo,
 * su chat queda vinculado y sus facturas por Telegram cumplen R11.
 */
export const POST = conSesion(
  async (req: Request) => {
    try {
      const bot = process.env.TELEGRAM_BOT_USUARIO?.replace(/^@/, "");
      const secreto = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
      if (!bot || !secreto) return error(503, "Telegram no está configurado (TELEGRAM_BOT_USUARIO y TELEGRAM_WEBHOOK_SECRET).");
      const { beneficiario_id } = await cuerpo(req, Cuerpo);
      const repo = await obtenerRepositorio();
      const b = (await repo.datosComunes()).beneficiarios.find((x) => x.id === beneficiario_id && x.estado === "activo");
      if (!b) return error(404, "No hay un beneficiario activo con ese id.");
      const token = crearTokenVinculo(b.id, await ahoraHumano(repo), secreto);
      return ok({ beneficiario: b.nombre, enlace: `https://t.me/${bot}?start=${token}` }, { status: 201 });
    } catch (e) {
      return manejar(e);
    }
  },
  // Vincular un canal cambia quién puede cobrar (sus facturas pasan R11): solo administradores, como los enlaces del portal.
  { permiso: "administrar" },
);
