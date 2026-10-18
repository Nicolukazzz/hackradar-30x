"use client";

import { Monto, mesAnio } from "@/app/_componentes";
import type { RespuestaBandeja } from "@/app/_datos/bandeja";
import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar";
import type { Moneda } from "@/dominio/tipos";
import { cn } from "@/lib/utils";

/**
 * Presupuesto del periodo (§6) en una mirada (#131): un anillo con cuánto se usó (Magic UI
 * `animated-circular-progress-bar`) y al lado lo que queda, que es lo que la persona quiere saber antes de aprobar.
 */
export function Presupuesto({ datos, mes: mesLote, moneda }: Readonly<{ datos: RespuestaBandeja["presupuesto"]; mes: string; moneda: Moneda }>) {
  const { monto_usd, pagado_antes, pagado_en_lote, reservado, disponible } = datos;
  const aprobado = pagado_antes + pagado_en_lote;
  const usado = monto_usd <= 0 ? 0 : Math.min(100, Math.round(((aprobado + reservado) / monto_usd) * 100));
  const sobregiro = disponible < 0;
  const mes = mesAnio(mesLote).split(" ")[0]?.toLowerCase();
  let color = "var(--color-pagada-punto)";
  if (usado >= 90) color = "var(--color-frenada-punto)";
  else if (usado >= 75) color = "var(--color-escalada-punto)";

  return (
    <section aria-labelledby="ppto" className="flex flex-col gap-5 rounded-[18px] bg-card p-5 ring-1 ring-border sm:flex-row sm:items-center sm:gap-7">
      <div className="flex items-center gap-4">
        <AnimatedCircularProgressBar
          value={usado}
          gaugePrimaryColor={color}
          gaugeSecondaryColor="var(--color-muted)"
          className="size-[88px] font-mono text-lg font-semibold [&>span]:after:text-xs [&>span]:after:text-muted-foreground [&>span]:after:content-['%']"
        />
        <div className="flex flex-col gap-1">
          <h2 id="ppto" className="text-[13px] text-muted-foreground">
            {sobregiro ? `Presupuesto de ${mes} superado por` : `Disponible para aprobar en ${mes}`}
          </h2>
          <span className={cn("font-mono text-[28px] leading-none font-semibold tracking-tight tabular-nums", sobregiro && "text-frenada-foreground")}>
            <Monto usd={Math.abs(disponible)} moneda={moneda} />
          </span>
          <span className="text-xs text-muted-foreground">
            de <Monto usd={monto_usd} moneda={moneda} /> · {usado} % usado
          </span>
        </div>
      </div>
      <dl className="flex flex-wrap gap-x-7 gap-y-2 sm:ml-auto">
        <div className="flex flex-col gap-0.5">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className="size-2 rounded-full bg-pagada-punto" />
            Aprobado
          </dt>
          <dd className="font-mono text-sm font-medium tabular-nums">
            <Monto usd={aprobado} moneda={moneda} />
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className="size-2 rounded-full bg-escalada-punto" />
            Apartado por aprobar
          </dt>
          <dd className="font-mono text-sm font-medium tabular-nums">
            <Monto usd={reservado} moneda={moneda} />
          </dd>
        </div>
      </dl>
    </section>
  );
}
