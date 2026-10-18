import { cn } from "@/lib/utils";

// Marca del producto (#152). Quadra firma, la empresa cliente protagoniza: el nombre de la empresa va arriba y en grande
// en cada pantalla; Quadra solo aparece como «Powered by Quadra», pequeño y al pie.

/** Isotipo: cuadrícula 2×2 en la que un cuadro destaca (la factura que cuadra). Decorativo: siempre va con texto. */
export function IsotipoQuadra({ className }: Readonly<{ className?: string }>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={cn("size-3.5 shrink-0", className)}>
      <rect x="0" y="0" width="7" height="7" rx="2" fill="currentColor" opacity="0.35" />
      <rect x="9" y="0" width="7" height="7" rx="2" fill="currentColor" opacity="0.35" />
      <rect x="0" y="9" width="7" height="7" rx="2" fill="currentColor" opacity="0.35" />
      <rect x="9" y="9" width="7" height="7" rx="2" className="fill-brand" />
    </svg>
  );
}

/**
 * Firma «Powered by Quadra». `tono` según el fondo: `claro` (login, portal) u `oscuro` (barra lateral).
 * El texto queda en inglés a propósito: es la fórmula reconocible de una marca que da el servicio.
 */
export function FirmaQuadra({ tono = "claro", className }: Readonly<{ tono?: "claro" | "oscuro"; className?: string }>) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] leading-none",
        tono === "claro" ? "text-muted-foreground" : "text-sidebar-muted",
        className,
      )}
    >
      <span>Powered by</span>
      <IsotipoQuadra />
      <span className={cn("font-semibold tracking-tight", tono === "claro" ? "text-foreground" : "text-sidebar-foreground")}>Quadra</span>
    </p>
  );
}
