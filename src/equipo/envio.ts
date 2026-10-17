import "server-only";

// Envío del correo de invitación (#80) por el SMTP del buzón del equipo (CORREO_IMAP_*, #14), el mismo de los avisos
// (#68). Sin buzón configurado (desarrollo, tests) no se envía: la pantalla muestra el enlace para copiarlo.

import type { CorreoInvitacion } from "./correo";

export type EnviarCorreo = (para: string, correo: CorreoInvitacion, remitente: string) => Promise<boolean>;

export const enviarCorreoInvitacion: EnviarCorreo = async (para, correo, remitente) => {
  const { configBuzonDesdeEntorno, crearTransporte } = await import("@/canales/correo/buzon");
  const buzon = configBuzonDesdeEntorno();
  if (!buzon) return false;
  await crearTransporte(buzon).sendMail({
    from: { name: remitente, address: buzon.usuario },
    to: para,
    subject: correo.asunto,
    text: correo.texto,
    html: correo.html,
    headers: { "Auto-Submitted": "auto-generated" },
  });
  return true;
};
