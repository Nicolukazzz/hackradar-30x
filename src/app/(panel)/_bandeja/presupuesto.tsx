import { Monto, Tarjeta, mesAnio } from "@/app/_componentes";
import type { RespuestaBandeja } from "@/app/_datos/bandeja";
import { cn } from "@/lib/utils";

const pct = (parte: number, total: number) => (total <= 0 ? 0 : Math.max(0, (parte / total) * 100));

/** Tarjeta "Presupuesto de {mes}" con barra apilada (§13.1, §6). */
export function Presupuesto({ datos, mes: mesLote }: { datos: RespuestaBandeja["presupuesto"]; mes: string }) {
  const { monto_usd, pagado_antes, pagado_en_lote, reservado, disponible } = datos;
  const tramos = [
    { etiqueta: "Pagado antes del lote", valor: pagado_antes, barra: "bg-punto-neutro", muestra: "bg-punto-neutro" },
    { etiqueta: "Pagado en este lote", valor: pagado_en_lote, barra: "bg-pagada-punto", muestra: "bg-pagada-punto" },
    {
      etiqueta: "Reservado por escalados",
      valor: reservado,
      barra: "bg-[repeating-linear-gradient(135deg,#e3a23a_0_6px,#f2c46e_6px_12px)]",
      muestra: "bg-[#e3a23a]",
    },
    { etiqueta: "Disponible para nuevos pagos", valor: Math.max(disponible, 0), barra: "bg-muted", muestra: "bg-muted ring-1 ring-[#c9cfc8]" },
  ];
  // Si lo pagado + reservado supera el presupuesto, la barra se escala al total para no recortarse.
  const base = Math.max(monto_usd, pagado_antes + pagado_en_lote + reservado);
  const sobregiro = disponible < 0;
  const resumen = tramos.map((t) => `${Math.round(pct(t.valor, base))}% ${t.etiqueta.toLowerCase()}`).join(", ");
  const mes = mesAnio(mesLote).split(" ")[0]?.toLowerCase();

  return (
    <Tarjeta as="section" aria-labelledby="ppto" className="gap-4 px-6 py-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="ppto" className="text-[17px] font-semibold tracking-tight">
            Presupuesto de {mes}
          </h2>
          <p className="text-[13px] text-muted-foreground">
            <Monto usd={monto_usd} /> · moneda base USD · tasas fijas del periodo
          </p>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] text-muted-foreground">{sobregiro ? "Sobre el presupuesto" : "Disponible"}</span>
          <span className={cn("text-[22px] font-semibold", disponible <= 0 && "text-frenada-foreground")}>
            {sobregiro ? "−" : ""}
            <Monto usd={Math.abs(disponible)} />
          </span>
        </div>
      </div>
      <div role="img" aria-label={`Presupuesto: ${resumen}`} className="flex h-3.5 overflow-hidden rounded-full bg-muted">
        {tramos.map((t, i) => (
          <div key={t.etiqueta} className={cn(t.barra, i > 0 && "border-l-2 border-card")} style={{ width: `${pct(t.valor, base).toFixed(2)}%` }} />
        ))}
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {tramos.map((t) => (
          <div key={t.etiqueta} className="flex items-start gap-2.5">
            <span aria-hidden className={cn("mt-1 size-2.5 shrink-0 rounded-[3px]", t.muestra)} />
            <div className="flex flex-col gap-0.5">
              <dt className="text-[13px] text-muted-foreground">{t.etiqueta}</dt>
              <dd className="text-sm font-medium">
                <Monto usd={t.valor} />
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </Tarjeta>
  );
}
