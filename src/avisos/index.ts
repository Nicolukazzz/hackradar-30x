// Avisador del proceso (#68). Se arma una vez desde el entorno: correo si hay Brevo (BREVO_API_KEY, #96),
// Teams si hay TEAMS_WEBHOOK_URL; sin ninguno (dev, tests, CI, CLI) no se avisa nada.
// `avisarEscaladas` no espera el envío: la respuesta al canal o al panel no queda colgada del correo.

import type { EntradaRegistro } from "@/dominio/tipos";

import type { Avisador } from "./enviar";

const CLAVE = Symbol.for("hackradar.avisos");
type Global = typeof globalThis & { [CLAVE]?: Promise<Avisador | null> };

async function desdeEntorno(env: NodeJS.ProcessEnv = process.env): Promise<Avisador | null> {
  if (env.AVISOS === "0") return null;
  const { configSalienteDesdeEntorno, enviarCorreo } = await import("@/canales/correo/saliente");
  const saliente = configSalienteDesdeEntorno(env);
  const teamsUrl = env.TEAMS_WEBHOOK_URL?.trim();
  if (!saliente && !teamsUrl) return null;

  const [{ crearAvisador }, { obtenerRepositorio }, { obtenerAlmacenEquipo }, { EMPRESA_ID }, { urlPublica }] = await Promise.all([
    import("./enviar"),
    import("@/repositorio"),
    import("@/equipo"),
    import("@/equipo/tipos"),
    import("@/lib/url-publica"),
  ]);
  return crearAvisador({
    // Siempre los datos de la corrida vigente ("Reiniciar demo" abre otra, #76).
    aprobadores: async () => (await (await obtenerRepositorio()).datosComunes()).aprobadores,
    miembros: async () => (await obtenerAlmacenEquipo()).miembros(EMPRESA_ID),
    enlace: (ref) => urlPublica(`/facturas/${encodeURIComponent(ref)}`, env),
    enviarCorreo: saliente
      ? (m) =>
          enviarCorreo(saliente, {
            para: [saliente.remitente], // los aprobadores van en copia oculta: no ven a quién más se avisó
            bcc: m.bcc,
            asunto: m.asunto,
            texto: m.texto,
            cabeceras: { "Auto-Submitted": "auto-generated" }, // RFC 3834: sin respuestas automáticas
          })
      : null,
    teams: teamsUrl ? { url: teamsUrl } : null,
  });
}

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
