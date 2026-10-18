// Envío del aviso de escalada (#68): correo a quien puede aprobar (SMTP del buzón del equipo, #14) y,
// si está configurado, un mensaje a un canal de Teams (webhook de Workflows). Cada canal falla por su
// lado y solo deja log: un aviso nunca cambia ni frena la decisión, que ya está en el registro.

import type { Aprobador, EntradaRegistro } from "@/dominio/tipos";
import type { Miembro } from "@/equipo/tipos";

import { armarAviso, destinatarios } from "./aviso";

/** Avisa una entrada del registro. Ignora lo que no sea ESCALAR. No lanza. */
export type Avisador = (entrada: EntradaRegistro, decidido_en?: string) => Promise<void>;

/** Correo del aviso. Los aprobadores van en copia oculta: no ven los correos de los demás. */
export type CorreoAviso = { bcc: string[]; asunto: string; texto: string };

/** Cómo obtener aprobadores y miembros, armar el enlace y enviar por cada canal (null = canal apagado). */
export type DependenciasAvisador = {
  aprobadores: () => Promise<readonly Aprobador[]>;
  /** miembros de la empresa (#51); de aquí salen los correos */
  miembros: () => Promise<readonly Miembro[]>;
  enlace: (ref: string) => string;
  /** null = sin buzón configurado: no se manda correo */
  enviarCorreo: ((m: CorreoAviso) => Promise<void>) | null;
  /** null = sin Teams */
  teams: { url: string; fetch?: typeof fetch } | null;
  registrar?: (datos: Record<string, unknown>) => void;
};

const registrarPorDefecto = (datos: Record<string, unknown>) => console.error(JSON.stringify({ aviso: "escalada", ...datos }));
const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Avisador que manda el correo y el mensaje de Teams en paralelo. Un canal que falla solo deja log; nunca lanza. */
export function crearAvisador(d: DependenciasAvisador): Avisador {
  const registrar = d.registrar ?? registrarPorDefecto;
  return async (entrada, decidido_en = entrada.momento) => {
    if (entrada.tipo !== "DECISION_AGENTE" || entrada.decision !== "ESCALAR") return;
    const ref = entrada.ref_interna;
    try {
      const aviso = armarAviso(entrada, { aprobadores: await d.aprobadores(), decidido_en, enlace: d.enlace(ref) });
      const envios: Promise<void>[] = [];
      if (d.enviarCorreo) envios.push(porCorreo(d, d.enviarCorreo, entrada, aviso.asunto, aviso.texto));
      // Teams interpreta Markdown: todo lo que viene de la factura va escapado; el único enlace es el de la traza.
      if (d.teams) envios.push(porTeams(d.teams, `**${escaparMarkdown(aviso.asunto)}**\n\n${escaparMarkdown(aviso.cuerpo)}\n\n[Decidir en el panel](${aviso.enlace})`));
      const canales = [...(d.enviarCorreo ? ["correo"] : []), ...(d.teams ? ["teams"] : [])];
      const resultados = await Promise.allSettled(envios);
      resultados.forEach((r, i) => {
        if (r.status === "rejected") registrar({ ref, canal: canales[i], error: mensaje(r.reason) });
      });
    } catch (e) {
      registrar({ ref, error: mensaje(e) });
    }
  };
}

async function porCorreo(d: DependenciasAvisador, enviar: (m: CorreoAviso) => Promise<void>, e: EntradaRegistro, asunto: string, texto: string) {
  const bcc = destinatarios(await d.miembros(), e.monto_usd_centavos).map((m) => m.correo.trim());
  if (bcc.length === 0) throw new Error("nadie del equipo puede aprobar esta factura");
  await enviar({ bcc, asunto, texto });
}

/** Escapa lo que Markdown de Teams interpretaría (enlaces, énfasis, código, HTML, títulos, listas). */
export function escaparMarkdown(texto: string): string {
  return texto.replace(/[\\`*_{}[\]()<>#+\-!|~]/g, "\\$&");
}

async function porTeams(teams: { url: string; fetch?: typeof fetch }, text: string) {
  const r = await (teams.fetch ?? fetch)(teams.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`Teams respondió ${r.status}`);
}
