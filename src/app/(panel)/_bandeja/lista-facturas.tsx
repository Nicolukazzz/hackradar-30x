"use client";

import { ArrowRightIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { Monto, MontoDudoso, PildoraDecision, VistaFactura, diaMes, etiquetaFormato, fechaCorta, hora } from "@/app/_componentes";
import type { CriteriosExtraccion } from "@/app/_datos/registro";
import type { FilaBandeja, FiltroDecision, RespuestaBandeja } from "@/app/_datos/bandeja";
import { cn } from "@/lib/utils";

import { FiltrosBandeja } from "./filtros";

// Facturas de la Bandeja (#131): la lista del Registro (una línea por factura con su estado) y, a la derecha, la vista
// previa de la factura elegida con lo que se leyó, lo que falta y por qué quedó así. La elección se copia a ?f=.

// #141: el monto seguro va en verde (el de «Pagada»); el dudoso, en naranja y convertido a la moneda base igual.
function MontoFila({ f }: { f: FilaBandeja }) {
  const usd = f.humana?.monto_usd_centavos ?? f.monto_usd_centavos;
  if (usd === null && f.decision !== "RECHAZADA_NO_FACTURA") return <MontoDudoso simple dinero={f.monto_original} confianza={f.monto_confianza} estimado={f.monto_estimado} />;
  return (
    <span className={usd === null ? undefined : "font-medium text-pagada-foreground"}>
      <Monto usd={usd} moneda={f.moneda_base} />
    </span>
  );
}

function Vista({ f, criterios }: { f: FilaBandeja; criterios: CriteriosExtraccion }) {
  const pendiente = f.estado === "ESCALAR";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <span>
          Recibida por {etiquetaFormato(f.formato).toLowerCase()} · {fechaCorta(f.recibido_en)}, {hora(f.recibido_en)}
        </span>
        <span className="font-mono">{f.ref_interna}</span>
      </div>

      {f.humana ? (
        <div className="flex flex-col gap-1.5 rounded-2xl bg-card px-4 py-3.5 ring-1 ring-border">
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {f.humana.actor.tipo === "humano" ? `Decisión de ${f.humana.actor.nombre.replace(/\s*\([^)]*\)\s*$/, "")}` : "Decisión"}
            <PildoraDecision decision={f.estado} />
          </span>
          {f.humana.comentario ? <span className="text-sm text-texto-3">«{f.humana.comentario}»</span> : null}
        </div>
      ) : null}

      <VistaFactura entrada={f.entrada} requeridos={criterios.requeridos} confianzaMinima={criterios.confianza_minima} />

      {pendiente ? (
        <Link
          href={`/facturas/${encodeURIComponent(f.ref_interna)}#decidir`}
          className="flex min-h-12 items-center justify-between rounded-[12px] bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Revisar y decidir
          <ArrowRightIcon className="size-4" aria-hidden />
        </Link>
      ) : null}
      <Link
        href={`/facturas/${encodeURIComponent(f.ref_interna)}`}
        className="flex min-h-11 items-center justify-between rounded-[12px] bg-card px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-muted"
      >
        Ver la factura completa
        <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  );
}

export function ListaFacturas({
  datos,
  decision,
  q,
  criterios,
  inicial,
}: Readonly<{ datos: RespuestaBandeja; decision: FiltroDecision; q: string; criterios: CriteriosExtraccion; inicial: string | null }>) {
  const { filas, conteos, meses } = datos;
  // Lo más nuevo arriba, como en el Registro.
  const orden = [...filas].reverse();
  const [sel, setSel] = useState(() => (inicial && orden.some((f) => f.ref_interna === inicial) ? inicial : (orden[0]?.ref_interna ?? null)));
  const panel = useRef<HTMLElement>(null);
  const elegida = orden.find((f) => f.ref_interna === sel) ?? orden[0] ?? null;

  function elegir(ref: string) {
    setSel(ref);
    const url = new URL(window.location.href);
    url.searchParams.set("f", ref);
    window.history.replaceState(window.history.state, "", url);
    if (window.matchMedia("(max-width: 1023px)").matches) panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section aria-labelledby="facturas" className="flex flex-col gap-4" id="facturas-lista">
      <div className="overflow-hidden rounded-[18px] bg-card ring-1 ring-border">
        <h2 id="facturas" className="sr-only">
          Facturas
        </h2>
        <FiltrosBandeja meses={meses} conteos={conteos} />
        <div className="h-4" />
      </div>

      {orden.length === 0 ? (
        <p className="rounded-[18px] bg-card px-6 py-14 text-center text-sm text-muted-foreground ring-1 ring-border">
          {q || decision !== "todas" || datos.mes_filtrado ? "Ninguna factura coincide con estos filtros." : "Todavía no hay facturas."}
        </p>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <ul aria-label="Lista de facturas" className="flex min-w-0 flex-[1.25_1_0%] flex-col overflow-hidden rounded-[18px] bg-card ring-1 ring-border">
            {orden.map((f) => {
              const activa = f.ref_interna === elegida?.ref_interna;
              return (
                <li key={f.ref_interna} className="border-subtle not-first:border-t">
                  <button
                    type="button"
                    aria-pressed={activa}
                    onClick={() => elegir(f.ref_interna)}
                    className={cn(
                      "grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-5",
                      activa ? "bg-brand/15" : "hover:bg-superficie-2/70",
                    )}
                  >
                    <span className="flex flex-col font-mono text-xs leading-tight text-muted-foreground tabular-nums">
                      <span>{diaMes(f.recibido_en)}</span>
                      <span>{hora(f.recibido_en)}</span>
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">{f.beneficiario ?? "Proveedor sin identificar"}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {f.factura_numero ?? f.ref_interna} · <MontoFila f={f} />
                      </span>
                    </span>
                    <PildoraDecision decision={f.estado} />
                  </button>
                </li>
              );
            })}
          </ul>

          <aside ref={panel} aria-label="Vista previa de la factura" className="flex min-w-0 scroll-mt-20 flex-col lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:flex-[1_1_0%] lg:overflow-y-auto">
            {elegida ? <Vista f={elegida} criterios={criterios} /> : null}
          </aside>
        </div>
      )}
    </section>
  );
}
