// Correo para crear la cuenta de un empleado (#80). Plantilla pura: el envío lo hace `envio.ts` con el SMTP del buzón
// del equipo. HTML con estilos en línea y tablas (lo que entienden Gmail y Outlook), más versión de texto.

import { NOMBRE_ROL, type Rol } from "@/lib/auth/permisos";

export type DatosCorreoInvitacion = {
  empresa: string;
  rol: Rol;
  /** quien crea la cuenta, para que la persona reconozca el correo */
  invitador: string;
  enlace: string;
  /** ISO */
  expira_en: string;
};

export type CorreoInvitacion = { asunto: string; texto: string; html: string };

function escapar(t: string): string {
  return t.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** "20 de octubre de 2026, 3:15 p. m. (hora de Bogotá)" */
export function fechaVencimiento(iso: string): string {
  const f = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "long", timeStyle: "short" }).format(new Date(iso));
  return `${f} (hora de Bogotá)`;
}

export function correoInvitacion(d: DatosCorreoInvitacion): CorreoInvitacion {
  const rol = NOMBRE_ROL[d.rol];
  const vence = fechaVencimiento(d.expira_en);
  const asunto = `${d.empresa}: crea tu cuenta en el agente de cuentas por pagar`;
  const texto = [
    "Hola:",
    "",
    `${d.invitador} creó tu acceso al agente de cuentas por pagar de ${d.empresa} con el rol de ${rol}.`,
    "",
    "Para activarlo, abre este enlace y elige tu nombre y tu contraseña:",
    d.enlace,
    "",
    `El enlace sirve una sola vez y vence el ${vence}. Si vence, pide uno nuevo a tu administrador.`,
    "",
    "Si no esperabas este correo, ignóralo: sin abrir el enlace no se crea ninguna cuenta.",
    "",
    `${d.empresa} · Agente de cuentas por pagar`,
  ].join("\n");

  const e = (t: string) => escapar(t);
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(asunto)}</title></head>
<body style="margin:0;padding:0;background:#F7F8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#101614;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8F5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E3E6E1;border-radius:16px;">
<tr><td style="padding:28px 32px 8px;">
<p style="margin:0;font-size:13px;color:#5B6661;">${e(d.empresa)} · Agente de cuentas por pagar</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.3;font-weight:600;">Crea tu cuenta</h1>
</td></tr>
<tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.6;">
<p style="margin:0 0 12px;">Hola:</p>
<p style="margin:0 0 12px;">${e(d.invitador)} creó tu acceso al agente de cuentas por pagar de <strong>${e(d.empresa)}</strong> con el rol de <strong>${e(rol)}</strong>.</p>
<p style="margin:0 0 20px;">Para activarlo, elige tu nombre y tu contraseña:</p>
</td></tr>
<tr><td style="padding:0 32px;">
<a href="${e(d.enlace)}" style="display:inline-block;background:#101614;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;padding:13px 22px;border-radius:10px;">Crear mi cuenta</a>
</td></tr>
<tr><td style="padding:20px 32px 0;font-size:13px;line-height:1.6;color:#5B6661;">
<p style="margin:0 0 8px;">El enlace sirve una sola vez y vence el <strong style="color:#101614;">${e(vence)}</strong>. Si vence, pide uno nuevo a tu administrador.</p>
<p style="margin:0 0 8px;">Si el botón no funciona, copia esta dirección en tu navegador:<br><a href="${e(d.enlace)}" style="color:#1F4FD1;word-break:break-all;">${e(d.enlace)}</a></p>
</td></tr>
<tr><td style="padding:20px 32px 28px;font-size:12px;line-height:1.6;color:#5B6661;border-top:1px solid #ECEEEA;">
Si no esperabas este correo, ignóralo: sin abrir el enlace no se crea ninguna cuenta.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  return { asunto, texto, html };
}
