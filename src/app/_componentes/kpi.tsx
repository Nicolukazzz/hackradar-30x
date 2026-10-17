import Link from "next/link";

import { cn } from "@/lib/utils";

// Indicador de la Bandeja (§13.1). destacado = "Pagos fuera de reglas" (fondo tinta, valor en acento).

const BASE = { caja: "bg-card ring-1 ring-border", etiqueta: "text-muted-foreground", detalle: "text-muted-foreground", punto: null };

const TONOS = {
  normal: BASE,
  pagada: { ...BASE, punto: "bg-pagada-punto" },
  frenada: { ...BASE, punto: "bg-frenada-punto" },
  destacado: { caja: "bg-primary text-primary-foreground", etiqueta: "text-primary-foreground/70", detalle: "text-primary-foreground/70", punto: null },
  escalada: {
    caja: "bg-escalada-suave ring-1 ring-escalada-borde",
    etiqueta: "text-escalada-foreground",
    detalle: "font-medium text-escalada-foreground",
    punto: "bg-escalada-punto",
  },
} satisfies Record<string, { caja: string; etiqueta: string; detalle: string; punto: string | null }>;

export function Kpi({
  etiqueta,
  valor,
  detalle,
  tono = "normal",
  icono,
  href,
  detalleMono = false,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  detalle?: React.ReactNode;
  tono?: keyof typeof TONOS;
  icono?: React.ReactNode;
  /** el KPI completo es un enlace (Escaladas → Aprobaciones) */
  href?: string;
  /** detalle en mono (montos: "USD 7.444,05") */
  detalleMono?: boolean;
}) {
  const t = TONOS[tono];
  const contenido = (
    <>
      <span className={cn("flex items-center gap-2 text-[13px]", t.etiqueta)}>
        {t.punto ? <span aria-hidden className={cn("size-2 rounded-full", t.punto)} /> : null}
        {icono}
        {etiqueta}
      </span>
      <span className={cn("font-mono text-4xl leading-none font-semibold tabular-nums", tono === "destacado" && "text-brand")}>{valor}</span>
      {detalle ? <span className={cn("text-[13px] leading-snug", t.detalle, detalleMono && "font-mono")}>{detalle}</span> : null}
    </>
  );
  const clase = cn("flex flex-col gap-2 rounded-[14px] px-5 py-[18px]", t.caja);
  if (href) {
    return (
      <Link
        href={href}
        className={cn(clase, "transition-shadow outline-none hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50")}
      >
        {contenido}
      </Link>
    );
  }
  return <div className={clase}>{contenido}</div>;
}
