// R11 Remitente verificado (§4.3, §16). Si falla, escala.

import { evaluacion } from "./catalogo";
import { type ContextoRegla, r3Falla } from "./contexto";

export function r11Remitente(ctx: ContextoRegla) {
  const { doc, beneficiario } = ctx;
  const rem = doc.remitente;
  const datos = { remitente_tipo: rem.tipo, remitente: rem.valor, vinculado_a: doc.beneficiario_remitente_id };

  if (rem.tipo === "interno") {
    if (r3Falla(ctx)) return evaluacion("R11", "FALLA", `reenvío interno de ${rem.valor}, pero el beneficiario no está en la lista`, datos);
    return evaluacion("R11", "CUMPLE", `reenvío interno de ${rem.valor} para un beneficiario de la lista`, datos);
  }
  if (beneficiario === null) {
    const texto = doc.beneficiario_remitente_id
      ? `${rem.valor} está vinculado a otro beneficiario, no a ${ctx.ext.beneficiario_nombre.valor ?? "quien cobra"}`
      : `${rem.valor} no está vinculado a ningún beneficiario`;
    return evaluacion("R11", "FALLA", texto, datos);
  }
  const c = beneficiario.canales;
  const vinculado =
    (rem.tipo === "correo" && c.correos.some((x) => x.toLowerCase() === rem.valor.toLowerCase())) ||
    (rem.tipo === "telegram" && c.telegram_chat_id === rem.valor) ||
    // Portal: el remitente lo pone el servidor desde la sesión verificada (usuario de portal o id del beneficiario).
    (rem.tipo === "portal" && (c.portal_usuario === rem.valor || beneficiario.id === rem.valor));
  if (!vinculado) return evaluacion("R11", "FALLA", `${rem.valor} no está vinculado a ${beneficiario.nombre}`, datos);
  const como = { correo: "correo", telegram: "Telegram", portal: "sesión de portal" }[rem.tipo];
  return evaluacion("R11", "CUMPLE", `${como} ${rem.valor} vinculado a ${beneficiario.nombre}`, datos);
}
