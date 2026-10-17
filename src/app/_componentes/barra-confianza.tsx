"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// Confianza de un campo extraído (§13.2): verde si ≥ umbral (R1, 90 %), ámbar si no.

export function BarraConfianza({
  valor,
  umbral = 0.9,
  campo,
  className,
}: {
  /** 0..1 */
  valor: number;
  umbral?: number;
  /** nombre del campo, para el lector de pantalla */
  campo?: string;
  className?: string;
}) {
  // Se trunca (no se redondea) para que etiqueta y color nunca se contradigan: 0,896 → 89 %, ámbar.
  const seguro = Number.isFinite(valor) ? Math.min(Math.max(valor, 0), 1) : 0;
  const pct = Math.floor(seguro * 100 + 1e-9);
  const ok = seguro >= umbral;
  return (
    <ProgressPrimitive.Root
      value={pct}
      aria-label={campo ? `Confianza de ${campo}` : "Confianza"}
      aria-valuetext={`${pct} %${ok ? "" : `, bajo el umbral de ${Math.round(umbral * 100)} %`}`}
      className={cn("flex items-center gap-2", className)}
    >
      <ProgressTrack className="h-1.5 flex-1 bg-muted">
        <ProgressIndicator className={cn("rounded-full", ok ? "bg-pagada-punto" : "bg-escalada-punto")} />
      </ProgressTrack>
      <span className={cn("w-9 text-right font-mono text-xs", ok ? "text-texto-3" : "font-semibold text-escalada-foreground")}>{pct}%</span>
    </ProgressPrimitive.Root>
  );
}
