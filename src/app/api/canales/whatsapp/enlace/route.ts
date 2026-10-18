import { z } from "zod";

import { crearTokenVinculo } from "@/canales/telegram/vinculo";
import { conSesion } from "@/lib/auth/ruta";
import { obtenerRepositorio } from "@/repositorio";
import { ahoraHumano } from "@/servicios/comun";

import { cuerpo, error, manejar, ok } from "../../../_http";

const Cuerpo = z.strictObject({ beneficiario_id: z.string().min(1).max(80) });

/**
 * POST /api/canales/whatsapp/enlace (#79): `{ beneficiario_id }` → `{ enlace }` = `https://wa.me/<numero>?text=VINCULAR <token>`
 * firmado, de un solo uso, vence en 72 h (mismo token que Telegram, con otra clave). Al mandar ese mensaje, el número
 * del proveedor queda vinculado y sus facturas por WhatsApp cumplen R11.
 */
export const POST = conSesion(
  async (req: Request) => {
    try {
      const numero = process.env.WHATSAPP_NUMERO?.replace(/\D/g, "");
      const verify = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
      if (!numero || !verify) return error(503, "WhatsApp no está configurado (WHATSAPP_NUMERO y WHATSAPP_VERIFY_TOKEN).");
      const { beneficiario_id } = await cuerpo(req, Cuerpo);
      const repo = await obtenerRepositorio();
      const b = (await repo.datosComunes()).beneficiarios.find((x) => x.id === beneficiario_id && x.estado === "activo");
      if (!b) return error(404, "No hay un beneficiario activo con ese id.");
      const token = crearTokenVinculo(b.id, await ahoraHumano(repo), `whatsapp:${verify}`);
      return ok({ beneficiario: b.nombre, enlace: `https://wa.me/${numero}?text=${encodeURIComponent(`VINCULAR ${token}`)}` }, { status: 201 });
    } catch (e) {
      return manejar(e);
    }
  },
  // Vincular un canal cambia quién puede cobrar (sus facturas pasan R11): solo administradores, como los enlaces del portal.
  { permiso: "administrar" },
);
