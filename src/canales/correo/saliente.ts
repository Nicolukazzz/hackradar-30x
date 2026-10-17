// Correo saliente (#96) por la API HTTPS de Brevo: respuestas al proveedor (#14), avisos a aprobadores (#68) e
// invitaciones (#80). No se usa SMTP porque Railway Hobby bloquea los puertos 25/465/587 y la conexión se cuelga.
// Leer el buzón (IMAP, 993) no cambia: sigue en buzon.ts.

export type ConfigSaliente = { apiKey: string; remitente: string };

export type CorreoSaliente = {
  para: string[];
  bcc?: string[];
  asunto: string;
  texto: string;
  html?: string;
  /** Nombre visible del remitente; por defecto el de la empresa. */
  nombre?: string;
  cabeceras?: Record<string, string>;
};

const URL_BREVO = "https://api.brevo.com/v3/smtp/email";
const NOMBRE_POR_DEFECTO = "Nébula Studio · Cuentas por pagar";

/** null si falta la llave (desarrollo, tests): no se manda nada y quien llama decide qué mostrar. */
export function configSalienteDesdeEntorno(env: NodeJS.ProcessEnv = process.env): ConfigSaliente | null {
  const apiKey = env.BREVO_API_KEY?.trim();
  const remitente = (env.CORREO_REMITENTE || env.CORREO_IMAP_USUARIO)?.trim();
  if (!apiKey || !remitente) return null;
  return { apiKey, remitente };
}

/** Lanza si Brevo no acepta el correo o no responde en `timeoutMs` (nunca deja un botón cargando). */
export async function enviarCorreo(
  config: ConfigSaliente,
  c: CorreoSaliente,
  opciones: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<void> {
  const r = await (opciones.fetch ?? fetch)(URL_BREVO, {
    method: "POST",
    headers: { "api-key": config.apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: c.nombre ?? NOMBRE_POR_DEFECTO, email: config.remitente },
      to: c.para.map((email) => ({ email })),
      ...(c.bcc?.length ? { bcc: c.bcc.map((email) => ({ email })) } : {}),
      subject: c.asunto,
      textContent: c.texto,
      ...(c.html ? { htmlContent: c.html } : {}),
      ...(c.cabeceras ? { headers: c.cabeceras } : {}),
    }),
    signal: AbortSignal.timeout(opciones.timeoutMs ?? 10_000),
  });
  if (!r.ok) {
    const detalle = await r.text().catch(() => "");
    throw new Error(`brevo ${r.status}: ${detalle.slice(0, 200)}`);
  }
}
