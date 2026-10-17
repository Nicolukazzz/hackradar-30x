import { ChevronLeftIcon, ChevronRightIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

// Ajustes estilo iPhone (#83): grupos de filas con ícono de color, título, valor actual y chevron. Cada fila abre una
// pantalla con pasos; una fila sin `href` muestra su valor (solo lectura) o queda marcada «Próximamente».

export function GrupoAjustes({ titulo, pie, children }: { titulo: string; pie?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-2">
      <h2 className="px-4 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{titulo}</h2>
      <ul className="flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border">{children}</ul>
      {pie ? <p className="px-4 text-xs leading-relaxed text-muted-foreground">{pie}</p> : null}
    </section>
  );
}

const COLORES = {
  tinta: "bg-primary text-primary-foreground",
  verde: "bg-pagada-punto text-white",
  ambar: "bg-escalada-punto text-white",
  azul: "bg-link text-white",
  gris: "bg-muted-foreground text-white",
} as const;

export function FilaAjuste({
  icono: Icono,
  color = "tinta",
  titulo,
  valor,
  href,
  proximamente = false,
}: {
  icono: LucideIcon;
  color?: keyof typeof COLORES;
  titulo: string;
  /** valor actual a la derecha ("USD", "Conectado") */
  valor?: React.ReactNode;
  href?: string;
  proximamente?: boolean;
}) {
  const contenido = (
    <>
      <span aria-hidden className={cn("flex size-8 flex-none items-center justify-center rounded-[9px]", COLORES[color], proximamente && "opacity-50")}>
        <Icono className="size-[18px]" />
      </span>
      <span className={cn("min-w-0 flex-1 truncate text-[15px]", proximamente && "text-muted-foreground")}>{titulo}</span>
      {proximamente ? (
        <span className="text-[13px] text-muted-foreground">Próximamente</span>
      ) : valor ? (
        <span className="max-w-[45%] truncate text-right text-[14px] text-muted-foreground">{valor}</span>
      ) : null}
      {href ? <ChevronRightIcon aria-hidden className="size-4 flex-none text-muted-foreground/70" /> : null}
    </>
  );
  const clase = "flex min-h-14 items-center gap-3 px-4 py-2.5";
  return (
    <li className="border-subtle not-first:border-t">
      {href && !proximamente ? (
        <Link href={href} className={cn(clase, "transition-colors outline-none hover:bg-superficie-2 focus-visible:bg-superficie-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset")}>
          {contenido}
        </Link>
      ) : (
        <div className={clase} aria-disabled={proximamente || undefined}>
          {contenido}
        </div>
      )}
    </li>
  );
}

/** «‹ Ajustes» arriba de cada pantalla de ajustes, como el botón atrás de iPhone. */
export function VolverAjustes() {
  return (
    <Link href="/ajustes" className="-ml-1 inline-flex min-h-11 items-center gap-0.5 self-start text-[15px] font-medium text-link hover:underline">
      <ChevronLeftIcon aria-hidden className="size-5" />
      Ajustes
    </Link>
  );
}
