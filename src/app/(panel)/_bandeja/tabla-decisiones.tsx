import { SearchIcon } from "lucide-react";
import Link from "next/link";

import { Monto, PildoraDecision, Tarjeta, TarjetaEncabezado, TarjetaPie, etiquetaFormato, hora } from "@/app/_componentes";
import type { FilaBandeja, FiltroDecision, RespuestaBandeja } from "@/app/_datos/bandeja";
import { cn } from "@/lib/utils";

const PESTANAS: { id: FiltroDecision; texto: string }[] = [
  { id: "todas", texto: "Todas" },
  { id: "pagar", texto: "Pagadas" },
  { id: "frenar", texto: "Frenadas" },
  { id: "escalar", texto: "Escaladas" },
];

const CELDA = "px-2 py-2.5 font-semibold";
const FILA = "px-2 py-3.5";

function hrefCon(decision: FiltroDecision, q: string) {
  const p = new URLSearchParams();
  if (decision !== "todas") p.set("decision", decision);
  if (q) p.set("q", q);
  const s = p.toString();
  return s ? `/?${s}#decisiones` : "/#decisiones";
}

function regla(f: FilaBandeja): string {
  if (f.decision === "PAGAR") return "R1–R11 ✓";
  if (f.decision === "RECHAZADA_NO_FACTURA") return "—";
  return f.reglas_que_fallaron.join(" · ");
}

function Decision({ f }: { f: FilaBandeja }) {
  return (
    <span className="flex flex-col items-start gap-1">
      <PildoraDecision decision={f.decision} />
      {f.estado !== f.decision ? <PildoraDecision decision={f.estado} className="text-[11px]" /> : null}
    </span>
  );
}

export function TablaDecisiones({ datos, decision, q }: { datos: RespuestaBandeja; decision: FiltroDecision; q: string }) {
  const { filas, conteos } = datos;
  return (
    <Tarjeta as="section" aria-labelledby="dec" id="decisiones" className="scroll-mt-20">
      <TarjetaEncabezado
        id="dec"
        titulo="Decisiones del lote"
        descripcion={`En el orden en que el agente las procesó. Montos convertidos a ${datos.moneda_base} con la tasa del periodo.`}
      >
        <nav aria-label="Filtrar por decisión" className="flex flex-wrap gap-2">
          {PESTANAS.map((p) => {
            const activa = p.id === decision;
            return (
              <Link
                key={p.id}
                href={hrefCon(p.id, q)}
                scroll={false}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-[10px] border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  activa ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                )}
              >
                {p.texto}
                <span className={cn("rounded-full px-1.5 py-0.5 font-mono text-xs", activa ? "bg-white/15" : "bg-muted text-texto-3")}>{conteos[p.id]}</span>
              </Link>
            );
          })}
        </nav>
        <form action="/#decisiones" role="search" className="relative">
          {decision !== "todas" ? <input type="hidden" name="decision" value={decision} /> : null}
          <label htmlFor="buscar" className="sr-only">
            Buscar factura o beneficiario
          </label>
          <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="buscar"
            name="q"
            type="search"
            defaultValue={q}
            autoComplete="off"
            spellCheck={false}
            placeholder="Buscar factura o beneficiario…"
            className="min-h-11 w-60 max-w-full rounded-[10px] border border-borde-fuerte bg-card pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </form>
      </TarjetaEncabezado>

      {filas.length === 0 ? (
        <p className="border-t border-border px-6 py-10 text-center text-sm text-muted-foreground">
          Ninguna factura coincide{q ? ` con «${q}»` : ""}.{" "}
          <Link href="/#decisiones" scroll={false} className="font-medium text-link hover:underline">
            Ver todas
          </Link>
        </p>
      ) : (
        <>
          {/* Escritorio: tabla del prototipo */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1080px] table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[148px]" />
                <col className="w-[18%]" />
                <col className="w-[150px]" />
                <col className="w-[104px]" />
                <col className="w-[150px]" />
                <col />
                <col className="w-[112px]" />
              </colgroup>
              <thead className="border-t border-border bg-superficie-2 text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className={cn(CELDA, "pl-6")}>Factura</th>
                  <th scope="col" className={CELDA}>Beneficiario</th>
                  <th scope="col" className={CELDA}>Monto original</th>
                  <th scope="col" className={cn(CELDA, "text-right")}>{datos.moneda_base}</th>
                  <th scope="col" className={CELDA}>Decisión</th>
                  <th scope="col" className={CELDA}>Por qué</th>
                  <th scope="col" className={cn(CELDA, "pr-6")}>Regla</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.ref_interna} className="border-t border-subtle align-middle transition-colors hover:bg-superficie-2/60">
                    <td className={cn(FILA, "pl-6")}>
                      <span className="flex flex-col gap-0.5">
                        <span className="font-mono text-[13px] font-semibold">{f.factura_numero ?? f.ref_interna}</span>
                        <span className="text-xs text-muted-foreground">
                          {etiquetaFormato(f.formato)} · {hora(f.recibido_en)}
                        </span>
                      </span>
                    </td>
                    <td className={FILA}>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">{f.beneficiario ?? "Sin nombre legible"}</span>
                        <span className="text-xs text-muted-foreground">{f.beneficiario_detalle}</span>
                      </span>
                    </td>
                    <td className={cn(FILA, "text-[13px] text-texto-3")}>
                      <Monto dinero={f.monto_original} />
                    </td>
                    <td className={cn(FILA, "text-right text-[13px] font-semibold")}>
                      <Monto usd={f.monto_usd_centavos} moneda={f.moneda_base} sinCodigo />
                    </td>
                    <td className={FILA}>
                      <Decision f={f} />
                    </td>
                    <td className={FILA}>
                      <span className="line-clamp-3 text-[13px] leading-snug text-texto-3">{f.explicacion}</span>
                    </td>
                    <td className={cn(FILA, "pr-6")}>
                      <span className="flex flex-col gap-1">
                        <span className="font-mono text-xs text-muted-foreground">{regla(f)}</span>
                        <Link href={`/facturas/${f.ref_interna}`} className="text-[13px] font-medium text-link hover:underline">
                          Ver traza<span className="sr-only"> de {f.factura_numero}</span>
                        </Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: una tarjeta por factura */}
          <ul className="flex flex-col md:hidden">
            {filas.map((f) => (
              <li key={f.ref_interna} className="border-t border-subtle">
                <Link href={`/facturas/${f.ref_interna}`} className="flex flex-col gap-2 px-4 py-4 outline-none focus-visible:bg-muted active:bg-muted">
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-mono text-[13px] font-semibold">{f.factura_numero ?? f.ref_interna}</span>
                      <span className="truncate text-sm font-medium">{f.beneficiario ?? "Sin nombre legible"}</span>
                    </span>
                    <Decision f={f} />
                  </span>
                  <span className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                    <Monto dinero={f.monto_original} className="text-texto-3" />
                    <span className="font-semibold">
                      {f.moneda_base} <Monto usd={f.monto_usd_centavos} moneda={f.moneda_base} sinCodigo />
                    </span>
                  </span>
                  <span className="line-clamp-3 text-[13px] leading-snug text-texto-3">{f.explicacion}</span>
                  <span className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {etiquetaFormato(f.formato)} · {hora(f.recibido_en)} · <span className="font-mono">{regla(f)}</span>
                    </span>
                    <span className="font-medium text-link">Ver traza →</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <TarjetaPie className="flex flex-wrap gap-x-5 gap-y-2">
        <span className="font-semibold text-foreground">Cómo combina las reglas:</span>
        <span>si falla una regla de frenar → Frenar</span>
        <span>si falla una regla de escalar → Escalar</span>
        <span>si todas cumplen → Pagar</span>
        <span>ante cualquier duda → Escalar, nunca Pagar</span>
      </TarjetaPie>
    </Tarjeta>
  );
}
