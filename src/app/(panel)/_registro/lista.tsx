"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ChipRegla, Monto, PILDORA, PildoraDecision, fechaCorta, hora } from "@/app/_componentes";
import type { DiaRegistro } from "@/app/_datos/registro";
import { Badge } from "@/components/ui/badge";
import type { EntradaRegistro } from "@/dominio/tipos";
import { cn } from "@/lib/utils";

// Lista agrupada por día + panel JSON de la entrada seleccionada (§13.5). La selección vive en el
// cliente (no recarga la página) y se copia a ?entrada= para poder compartir el enlace.

const SIN_DECISION: Record<EntradaRegistro["tipo"], string> = {
  DECISION_AGENTE: "Sin decisión",
  DECISION_HUMANA: "1 de 2 aprobaciones",
  CAMBIO_REGLAS: "Cambio de reglas",
  CAMBIO_BENEFICIARIOS: "Cambio de beneficiarios",
  CAMBIO_EMPRESA: "Cambio de datos de la empresa",
};

function Pildora({ e }: { e: EntradaRegistro }) {
  if (e.decision) return <PildoraDecision decision={e.decision} />;
  return <Badge className={cn(PILDORA, "bg-muted text-muted-foreground")}>{SIN_DECISION[e.tipo]}</Badge>;
}

/** "Laura Méndez (laura@…)" → "Laura Méndez": el correo completo queda en el JSON. */
function actor(e: EntradaRegistro): string {
  return e.actor.tipo === "agente" ? "Agente" : e.actor.nombre.replace(/\s*\([^)]*\)\s*$/, "");
}

function resumenDia(entradas: EntradaRegistro[]): string {
  const agente = entradas.filter((e) => e.tipo === "DECISION_AGENTE").length;
  const humanas = entradas.filter((e) => e.tipo === "DECISION_HUMANA").length;
  const cambios = entradas.length - agente - humanas;
  const partes = [
    agente ? (agente === 1 ? "1 factura" : `lote de ${agente} facturas`) : null,
    humanas ? (humanas === 1 ? "1 decisión humana" : `${humanas} decisiones humanas`) : null,
    cambios ? (cambios === 1 ? "1 cambio de configuración" : `${cambios} cambios de configuración`) : null,
  ];
  return partes.filter(Boolean).join(" · ");
}

function etiquetaDia(fecha: string, hoy: string, ayer: string): string {
  const base = `${fechaCorta(fecha)} · `;
  if (fecha === hoy) return `Hoy · ${base}`;
  if (fecha === ayer) return `Ayer · ${base}`;
  return base;
}

export function ListaRegistro({ dias, inicial, hoy, ayer }: { dias: DiaRegistro[]; inicial: string | null; hoy: string; ayer: string }) {
  const todas = dias.flatMap((d) => d.entradas);
  const [sel, setSel] = useState(() => (inicial && todas.some((e) => e.id === inicial) ? inicial : (todas[0]?.id ?? null)));
  const panel = useRef<HTMLElement>(null);
  const elegida = todas.find((e) => e.id === sel) ?? null;

  function elegir(id: string) {
    setSel(id);
    const url = new URL(window.location.href);
    url.searchParams.set("entrada", id);
    window.history.replaceState(window.history.state, "", url);
    // En móvil el panel queda debajo de la lista: llevar a la persona hasta él.
    if (window.matchMedia("(max-width: 1023px)").matches) panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <section aria-label="Entradas del registro" className="flex min-w-0 flex-[1.6_1_0%] flex-col gap-5">
        {dias.map((d) => (
          <div key={d.fecha} className="flex flex-col gap-2">
            <h2 className="text-[13px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              {etiquetaDia(d.fecha, hoy, ayer)}
              {resumenDia(d.entradas)}
            </h2>
            <ul className="flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border">
              {d.entradas.map((e) => {
                const activa = e.id === sel;
                return (
                  <li key={e.id} className="border-subtle not-first:border-t">
                    <button
                      type="button"
                      aria-pressed={activa}
                      onClick={() => elegir(e.id)}
                      className={cn(
                        "flex w-full items-start gap-4 px-4 py-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-5",
                        activa ? "bg-brand/15 shadow-[inset_0_0_0_2px_var(--color-primary)]" : "hover:bg-superficie-2/70",
                      )}
                    >
                      <span className="flex w-[76px] flex-none flex-col gap-1">
                        <span className="font-mono text-[13px] font-semibold tabular-nums">{hora(e.momento, true)}</span>
                        <span className="truncate text-xs text-muted-foreground">{actor(e)}</span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <Pildora e={e} />
                          <span className="font-mono text-[13px] font-semibold">{e.factura_numero ?? e.ref_interna}</span>
                          {e.beneficiario ? <span className="text-sm font-medium">{e.beneficiario}</span> : null}
                          {e.monto_usd_centavos !== null ? <Monto usd={e.monto_usd_centavos} className="text-[13px] text-muted-foreground" /> : null}
                        </span>
                        <span className="text-sm leading-relaxed text-pretty text-texto-3">{e.explicacion}</span>
                        {e.comentario && !e.explicacion.includes(e.comentario) ? <span className="text-sm leading-relaxed text-texto-3">Comentario: «{e.comentario}»</span> : null}
                        {e.comparaciones.length > 0 ? (
                          <span className="flex flex-wrap gap-1.5">
                            {e.comparaciones.map((c) => (
                              <ChipRegla key={c} texto={c} />
                            ))}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <aside ref={panel} aria-labelledby="registro-sel" className="flex min-w-0 scroll-mt-20 flex-col gap-3.5 lg:sticky lg:top-6 lg:flex-[1_1_0%]">
        <div className="flex flex-col overflow-hidden rounded-2xl bg-sidebar text-sidebar-foreground">
          <div className="flex items-center justify-between gap-2.5 border-b border-sidebar-border px-5 py-4">
            <h2 id="registro-sel" className="text-[15px] font-semibold">
              {elegida ? (
                <>
                  Entrada <span className="font-mono">{elegida.id}</span>
                </>
              ) : (
                "Ninguna entrada seleccionada"
              )}
            </h2>
            <span className="font-mono text-xs text-sidebar-muted">JSON · solo lectura</span>
          </div>
          {elegida ? (
            <pre
              tabIndex={0}
              aria-label={`Entrada ${elegida.id} en JSON`}
              className="max-h-[60vh] overflow-auto px-5 py-4 font-mono text-[12.5px] leading-relaxed break-words whitespace-pre-wrap text-sidebar-foreground/90 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset lg:max-h-[calc(100vh-22rem)]"
            >
              {JSON.stringify(elegida, null, 2)}
            </pre>
          ) : (
            <p className="px-5 py-6 text-sm text-sidebar-muted">Elige una entrada de la lista para ver todo lo que guardó el registro.</p>
          )}
          {elegida && elegida.tipo !== "CAMBIO_REGLAS" ? (
            <div className="border-t border-sidebar-border px-5 py-3 text-sm">
              <Link href={`/facturas/${elegida.ref_interna}`} className="font-medium text-sidebar-primary hover:underline">
                Ver traza de {elegida.factura_numero ?? elegida.ref_interna} →
              </Link>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2.5 rounded-2xl bg-card px-5 py-4.5 ring-1 ring-border">
          <h3 className="text-[15px] font-semibold">Qué garantiza el registro</h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-4.5 text-sm leading-relaxed text-texto-3">
            <li>Cada entrada guarda la versión de reglas y la tasa de cambio usadas.</li>
            <li>Las decisiones humanas se agregan como entradas nuevas: nada se sobrescribe.</li>
            <li>La explicación en español sale de los valores comparados, no la inventa el modelo.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
