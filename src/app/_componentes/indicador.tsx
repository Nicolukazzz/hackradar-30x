"use client";

import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { MagicCard } from "@/components/ui/magic-card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

// Indicador del panel (#131): tarjeta con el foco de luz de Magic UI al pasar el cursor (sobrio: borde lima suave) y el
// número que cuenta hasta su valor (Magic UI `number-ticker`), así un cambio que llega en vivo se nota sin parpadear.
// Una línea para qué es, el número grande, el monto debajo y, si aplica, adónde ir.

type Tono = "neutro" | "atencion" | "urgente" | "bien" | "freno";

const PUNTO: Record<Tono, string | null> = {
  neutro: null,
  atencion: "bg-escalada-punto",
  urgente: "bg-frenada-punto",
  bien: "bg-pagada-punto",
  freno: "bg-frenada-punto",
};

export function Indicador({
  etiqueta,
  valor,
  detalle,
  pie,
  href,
  tono = "neutro",
  className,
}: Readonly<{
  etiqueta: string;
  valor: number;
  /** el monto o una frase corta */
  detalle?: React.ReactNode;
  /** texto pequeño abajo (p. ej. «2 vencen hoy») */
  pie?: React.ReactNode;
  href?: string;
  tono?: Tono;
  className?: string;
}>) {
  const punto = PUNTO[tono];
  // Se pinta el número real desde el principio (sin JS también); el conteo anima solo los cambios que llegan en vivo.
  const [inicial] = useState(valor);
  const contenido = (
    <MagicCard className="h-full rounded-[18px]" gradientSize={180} gradientColor="#EEF0EC" gradientOpacity={0.7} gradientFrom="#C8F169" gradientTo="#7FE0C3">
      <div className="relative z-40 flex h-full flex-col gap-3 p-5">
        <span className="flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
          <span className="flex items-center gap-2">
            {punto ? <span aria-hidden className={cn("size-2 rounded-full", punto)} /> : null}
            {etiqueta}
          </span>
          {href ? <ArrowUpRightIcon aria-hidden className="size-4 opacity-0 transition-opacity group-hover:opacity-100" /> : null}
        </span>
        <span className={cn("font-mono text-[34px] leading-none font-semibold tracking-tight", tono === "urgente" && valor > 0 && "text-frenada-foreground")}>
          <NumberTicker value={valor} startValue={inicial} />
        </span>
        <span className="mt-auto flex flex-col gap-0.5">
          {detalle ? <span className="text-[13px] text-texto-3 tabular-nums">{detalle}</span> : null}
          {pie ? <span className="text-xs text-muted-foreground">{pie}</span> : null}
        </span>
      </div>
    </MagicCard>
  );
  if (!href) return <div className={className}>{contenido}</div>;
  return (
    <Link href={href} className={cn("block rounded-[18px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}>
      {contenido}
    </Link>
  );
}
