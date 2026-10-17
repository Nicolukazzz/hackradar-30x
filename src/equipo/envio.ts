import "server-only";

// Envío del correo de invitación (#80) por Brevo (BREVO_API_KEY, #96), el mismo canal de los avisos (#68).
// Sin llave (desarrollo, tests) o si Brevo falla, devuelve false: la pantalla muestra el enlace para copiarlo.

import type { CorreoInvitacion } from "./correo";

export type EnviarCorreo = (para: string, correo: CorreoInvitacion, remitente: string) => Promise<boolean>;

export const enviarCorreoInvitacion: EnviarCorreo = async (para, correo, remitente) => {
  const { configSalienteDesdeEntorno, enviarCorreo } = await import("@/canales/correo/saliente");
  const saliente = configSalienteDesdeEntorno();
  if (!saliente) return false;
  try {
    await enviarCorreo(saliente, {
      para: [para],
      nombre: remitente,
      asunto: correo.asunto,
      texto: correo.texto,
      html: correo.html,
      cabeceras: { "Auto-Submitted": "auto-generated" },
    });
    return true;
  } catch (e) {
    console.error(JSON.stringify({ correo: "invitacion", error: e instanceof Error ? e.message : String(e) }));
    return false;
  }
};
