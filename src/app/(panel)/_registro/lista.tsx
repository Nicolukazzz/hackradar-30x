"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { Monto, PILDORA, PildoraDecision, VistaFactura, fechaCorta, hora } from "@/app/_componentes";
import type { CriteriosExtraccion, DiaRegistro } from "@/app/_datos/registro";
import { Badge } from "@/components/ui/badge";
import type { EntradaRegistro } from "@/dominio/tipos";
import { cn } from "@/lib/utils";

// Registro (§13.5, #119): a la izquierda, una línea por entrada (cuándo, quién, qué, cuánto); a la derecha, la entrada
// elegida como factura legible (qué se leyó, qué falta y qué no se cumplió). La selección se copia a ?entrada=.

const SIN_DECISION: Record<EntradaRegistro["tipo"], string> = {
  DECISION_AGENTE: "Sin decisión",
  DECISION_HUMANA: "1 de 2 firmas",
  CAMBIO_REGLAS: "Reglas",
  CAMBIO_BENEFICIARIOS: "Proveedores",
  CAMBIO_EMPRESA: "Empresa",
};

function Pildora({ e }: { e: EntradaRegistro }) {
  if (e.decision) return <PildoraDecision decision={e.decision} />;
  return <Badge className={cn(PILDORA, "bg-muted text-muted-foreground")}>{SIN_DECISION[e.tipo]}</Badge>;
}

/** "Laura Méndez (laura@…)" → "Laura Méndez". */
function actor(e: EntradaRegistro): string {
  return e.actor.tipo === "agente" ? "Agente" : e.actor.nombre.replace(/\s*\([^)]*\)\s*$/, "");
}

/** Título de la línea: la factura y su proveedor, o qué se cambió. */
function titulo(e: EntradaRegistro): string {
  if (e.tipo === "CAMBIO_REGLAS") return "Cambio en las reglas de pago";
  if (e.tipo === "CAMBIO_EMPRESA") return "Cambio en los datos de la empresa";
  if (e.tipo === "CAMBIO_BENEFICIARIOS") return e.beneficiario ? `Proveedor: ${e.beneficiario}` : "Cambio en proveedores";
  return e.beneficiario ?? "Proveedor sin identificar";
}

function etiquetaDia(fecha: string, hoy: string, ayer: string): string {
  if (fecha === hoy) return `Hoy · ${fechaCorta(fecha)}`;
  if (fecha === ayer) return `Ayer · ${fechaCorta(fecha)}`;
  return fechaCorta(fecha);
}

/** Panel derecho: la factura (o lo que cambió) en palabras. */
function Detalle({ e, todas, criterios }: { e: EntradaRegistro; todas: EntradaRegistro[]; criterios: CriteriosExtraccion }) {
  const origen = e.tipo === "DECISION_HUMANA" ? todas.find((x) => x.id === e.entrada_origen) : undefined;
  const factura = e.tipo === "DECISION_AGENTE" ? e : origen;
  const esFactura = e.tipo === "DECISION_AGENTE" || e.tipo === "DECISION_HUMANA";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <span>
          {fechaCorta(e.momento)}, {hora(e.momento, true)} · {actor(e)}
        </span>
        <span className="font-mono">{e.id}</span>
      </div>

      {e.tipo === "DECISION_HUMANA" ? (
        <div className="flex flex-col gap-1.5 rounded-2xl bg-card px-4 py-3.5 ring-1 ring-border">
          <span className="flex items-center gap-2 text-sm font-semibold">
            Decisión de {actor(e)} <Pildora e={e} />
          </span>
          {e.comentario ? <span className="text-sm text-texto-3">«{e.comentario}»</span> : null}
        </div>
      ) : null}

      {factura ? (
        <VistaFactura entrada={factura} requeridos={criterios.requeridos} confianzaMinima={criterios.confianza_minima} />
      ) : (
        <p className="rounded-2xl bg-card px-4 py-4 text-sm leading-relaxed text-texto-3 ring-1 ring-border">{e.explicacion}</p>
      )}

      {esFactura ? (
        <Link
          href={`/facturas/${e.ref_interna}`}
          className="flex min-h-11 items-center justify-between rounded-[12px] bg-card px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-muted"
        >
          Ver la factura completa
          <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export function ListaRegistro({
  dias,
  inicial,
  hoy,
  ayer,
  criterios,
}: {
  dias: DiaRegistro[];
  inicial: string | null;
  hoy: string;
  ayer: string;
  criterios: CriteriosExtraccion;
}) {
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
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <section aria-label="Entradas del registro" className="flex min-w-0 flex-[1.3_1_0%] flex-col gap-5">
        {dias.map((d) => (
          <div key={d.fecha} className="flex flex-col gap-2">
            <h2 className="px-1 text-[13px] font-medium text-muted-foreground">
              {etiquetaDia(d.fecha, hoy, ayer)} · {d.entradas.length} {d.entradas.length === 1 ? "entrada" : "entradas"}
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
                        "grid w-full grid-cols-[52px_1fr_auto] items-center gap-3 px-4 py-3.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-5",
                        activa ? "bg-brand/15" : "hover:bg-superficie-2/70",
                      )}
                    >
                      <span className="font-mono text-[13px] text-muted-foreground tabular-nums">{hora(e.momento)}</span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">{titulo(e)}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {actor(e)}
                          {e.factura_numero ? ` · ${e.factura_numero}` : ""}
                          {e.monto_usd_centavos !== null ? (
                            <>
                              {" · "}
                              <Monto usd={e.monto_usd_centavos} moneda={e.moneda_base} />
                            </>
                          ) : null}
                        </span>
                      </span>
                      <Pildora e={e} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <aside ref={panel} aria-label="Entrada seleccionada" className="flex min-w-0 scroll-mt-20 flex-col lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:flex-[1_1_0%] lg:overflow-y-auto">
        {elegida ? <Detalle e={elegida} todas={todas} criterios={criterios} /> : <p className="text-sm text-muted-foreground">Elige una entrada para verla.</p>}
      </aside>
    </div>
  );
}
