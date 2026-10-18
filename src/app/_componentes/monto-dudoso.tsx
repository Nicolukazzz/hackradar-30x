"use client";

import { TriangleAlertIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatear } from "@/dominio/dinero";
import type { Dinero } from "@/dominio/tipos";
import { cn } from "@/lib/utils";

// Monto que el agente leyó sin confianza (#129): se muestra igual, en naranja claro y con un aviso; al pasar el cursor
// dice por qué. Antes las listas mostraban «—» y no se sabía de cuánto era la factura.

export function razonMontoDudoso(dinero: Dinero | null, confianza: number | null): string {
  if (!dinero) return "El agente no pudo leer el total de esta factura. Una persona debe escribirlo antes de aprobar.";
  const pct = confianza === null ? null : Math.floor(confianza * 100);
  // Leído con confianza pero sin pasar una validación (p. ej. subtotal + impuestos ≠ total, R1): no es la lectura, es el dato.
  if (pct !== null && pct >= 90) return "El total no cuadra con el resto de la factura (subtotal + impuestos u otra validación). Revísalo antes de aprobar.";
  return `El agente no está seguro de este monto${pct === null ? "" : ` (confianza ${pct} %)`}. Revísalo en la factura antes de aprobar.`;
}

export function MontoDudoso({
  dinero,
  confianza,
  className,
  simple = false,
}: Readonly<{ dinero: Dinero | null; confianza: number | null; className?: string; /** dentro de un botón: sin tooltip interactivo, solo `title` */ simple?: boolean }>) {
  const razon = razonMontoDudoso(dinero, confianza);
  if (simple) {
    return (
      <span title={razon} className={cn("inline-flex items-center gap-1 font-mono whitespace-nowrap text-escalada-punto tabular-nums", className)}>
        {dinero ? formatear(dinero) : "Sin leer"}
        <TriangleAlertIcon className="size-3 shrink-0" aria-hidden />
        <span className="sr-only">{razon}</span>
      </span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span tabIndex={0} />}
        aria-label={`${dinero ? formatear(dinero) : "Total sin leer"}. ${razon}`}
        className={cn(
          "inline-flex cursor-help items-center gap-1 rounded-[6px] font-mono whitespace-nowrap text-escalada-punto tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          className,
        )}
      >
        {dinero ? formatear(dinero) : "Sin leer"}
        <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden />
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-pretty">{razon}</TooltipContent>
    </Tooltip>
  );
}
