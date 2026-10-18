import { Monto, Tarjeta, mesAnio } from "@/app/_componentes";
import type { RespuestaBandeja } from "@/app/_datos/bandeja";
import type { Moneda } from "@/dominio/tipos";
import { cn } from "@/lib/utils";

const pct = (parte: number, total: number) => (total <= 0 ? 0 : Math.max(0, (parte / total) * 100));

/** Presupuesto del periodo (§6) en una mirada: cuánto queda, y una barra con pagado · reservado · disponible. */
export function Presupuesto({ datos, mes: mesLote, moneda }: Readonly<{ datos: RespuestaBandeja["presupuesto"]; mes: string; moneda: Moneda }>) {
  const { monto_usd, pagado_antes, pagado_en_lote, reservado, disponible } = datos;
  const pagado = pagado_antes + pagado_en_lote;
  const tramos = [
    { etiqueta: "Pagado", valor: pagado, color: "bg-pagada-punto" },
    { etiqueta: "Reservado para aprobar", valor: reservado, color: "bg-escalada-punto" },
    { etiqueta: "Disponible", valor: Math.max(disponible, 0), color: "bg-muted ring-1 ring-inset ring-borde-fuerte" },
  ];
  const base = Math.max(monto_usd, pagado + reservado);
  const sobregiro = disponible < 0;
  const mes = mesAnio(mesLote).split(" ")[0]?.toLowerCase();

  return (
    <Tarjeta as="section" aria-labelledby="ppto" className="gap-4 px-6 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="ppto" className="text-[13px] text-muted-foreground">
            {sobregiro ? `Presupuesto de ${mes} superado por` : `Disponible en ${mes}`}
          </h2>
          <span className={cn("font-mono text-[28px] leading-none font-semibold tabular-nums", sobregiro && "text-frenada-foreground")}>
            <Monto usd={Math.abs(disponible)} moneda={moneda} />
          </span>
        </div>
        <span className="text-[13px] text-muted-foreground">
          de <Monto usd={monto_usd} moneda={moneda} />
        </span>
      </div>
      <div
        role="img"
        aria-label={tramos.map((t) => `${t.etiqueta}: ${Math.round(pct(t.valor, base))}%`).join(", ")}
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
      >
        {tramos.slice(0, 2).map((t) => (
          <div key={t.etiqueta} className={t.color} style={{ width: `${pct(t.valor, base).toFixed(2)}%` }} />
        ))}
      </div>
      <dl className="flex flex-wrap gap-x-8 gap-y-2">
        {tramos.map((t) => (
          <div key={t.etiqueta} className="flex items-center gap-2 text-[13px]">
            <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", t.color)} />
            <dt className="text-muted-foreground">{t.etiqueta}</dt>
            <dd className="font-mono font-medium tabular-nums">
              <Monto usd={t.valor} moneda={moneda} />
            </dd>
          </div>
        ))}
      </dl>
    </Tarjeta>
  );
}
