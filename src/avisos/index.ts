// Avisador del proceso (#68). Se arma una vez desde el entorno: correo si hay buzón (CORREO_IMAP_*, #14),
// Teams si hay TEAMS_WEBHOOK_URL; sin ninguno (dev, tests, CI, CLI) no se avisa nada.
// `avisarEscaladas` no espera el envío: la respuesta al canal o al panel no queda colgada de SMTP.

import type { EntradaRegistro } from "@/dominio/tipos";

import type { Avisador } from "./enviar";

const CLAVE = Symbol.for("hackradar.avisos");
type Global = typeof globalThis & { [CLAVE]?: Promise<Avisador | null> };

async function desdeEntorno(env: NodeJS.ProcessEnv = process.env): Promise<Avisador | null> {
  if (env.AVISOS === "0") return null;
  const { configBuzonDesdeEntorno } = await import("@/canales/correo/buzon");
  const buzon = configBuzonDesdeEntorno(env);
  const teamsUrl = env.TEAMS_WEBHOOK_URL?.trim();
  if (!buzon && !teamsUrl) return null;

  const [{ crearAvisador }, { crearTransporte }, { obtenerRepositorio }, { obtenerAlmacenEquipo }, { EMPRESA_ID }, { urlPublica }] = await Promise.all([
    import("./enviar"),
    import("@/canales/correo/buzon"),
    import("@/repositorio"),
    import("@/equipo"),
    import("@/equipo/tipos"),
    import("@/lib/url-publica"),
  ]);
  const transporte = buzon ? crearTransporte(buzon) : null;
  return crearAvisador({
    // Siempre los datos de la corrida vigente ("Reiniciar demo" abre otra, #76).
    aprobadores: async () => (await (await obtenerRepositorio()).datosComunes()).aprobadores,
    miembros: async () => (await obtenerAlmacenEquipo()).miembros(EMPRESA_ID),
    enlace: (ref) => urlPublica(`/facturas/${encodeURIComponent(ref)}`, env),
    enviarCorreo:
      buzon && transporte
        ? async (m) => {
            await transporte.sendMail({
              from: buzon.usuario,
              to: buzon.usuario,
              bcc: m.bcc,
              subject: m.asunto,
              text: m.texto,
              headers: { "Auto-Submitted": "auto-generated" }, // RFC 3834: sin respuestas automáticas
            });
          }
        : null,
    teams: teamsUrl ? { url: teamsUrl } : null,
  });
}

/** Avisador del proceso, armado una sola vez desde el entorno. null si no hay buzón ni Teams o si `AVISOS=0`. */
export function obtenerAvisador(): Promise<Avisador | null> {
  const g = globalThis as Global;
  g[CLAVE] ??= desdeEntorno().catch((e: unknown) => {
    g[CLAVE] = undefined;
    console.error(JSON.stringify({ aviso: "escalada", error: e instanceof Error ? e.message : String(e) }));
    return null;
  });
  return g[CLAVE];
}

/** Solo tests: fija el avisador (null = no avisar). */
export function fijarAvisador(a: Avisador | null): void {
  (globalThis as Global)[CLAVE] = Promise.resolve(a);
}

/** Avisa en segundo plano las escaladas de `entradas` (ya registradas). Nunca lanza ni espera. */
export function avisarEscaladas(entradas: readonly EntradaRegistro[], decidido_en?: string): void {
  const escaladas = entradas.filter((e) => e.tipo === "DECISION_AGENTE" && e.decision === "ESCALAR");
  if (escaladas.length === 0) return;
  void obtenerAvisador()
    .then(async (avisar) => {
      if (avisar) for (const e of escaladas) await avisar(e, decidido_en);
    })
    .catch((e: unknown) => console.error(JSON.stringify({ aviso: "escalada", error: e instanceof Error ? e.message : String(e) })));
}
