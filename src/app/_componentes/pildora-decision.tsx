import { Badge } from "@/components/ui/badge";
import type { DecisionAgente, DecisionHumana, ResultadoRegla } from "@/dominio/tipos";
import { cn } from "@/lib/utils";

// Píldoras de decisión (§13 "Comunes") y de resultado de regla (§13.2 traza). Colores §15.

const DECISIONES: Record<DecisionAgente | DecisionHumana, { texto: string; clase: string; punto?: string }> = {
  PAGAR: { texto: "Pagada", clase: "bg-pagada text-pagada-foreground", punto: "bg-pagada-punto" },
  FRENAR: { texto: "Frenada", clase: "bg-frenada text-frenada-foreground", punto: "bg-frenada-punto" },
  ESCALAR: { texto: "Escalada", clase: "bg-escalada text-escalada-foreground", punto: "bg-escalada-punto" },
  RECHAZADA_NO_FACTURA: { texto: "No es factura", clase: "bg-muted text-muted-foreground", punto: "bg-muted-foreground" },
  APROBADA_HUMANO: { texto: "Aprobada por persona", clase: "border-pagada-punto bg-card text-pagada-foreground" },
  RECHAZADA_HUMANO: { texto: "Rechazada por persona", clase: "border-frenada-punto bg-card text-frenada-foreground" },
};

const PILDORA = "h-auto gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold";

export function PildoraDecision({ decision, className }: { decision: DecisionAgente | DecisionHumana; className?: string }) {
  const d = DECISIONES[decision];
  return (
    <Badge className={cn(PILDORA, d.clase, className)}>
      {d.punto ? <span aria-hidden className={cn("size-1.5 rounded-full", d.punto)} /> : null}
      {d.texto}
    </Badge>
  );
}

/** Resultado de una regla en la traza: Cumple / Falla · frena / Falla · escala / No aplica / Indeterminado. */
export function PildoraResultado({
  resultado,
  siFalla,
  className,
}: {
  resultado: ResultadoRegla;
  siFalla: "FRENAR" | "ESCALAR";
  className?: string;
}) {
  const { texto, clase } =
    resultado === "CUMPLE"
      ? { texto: "Cumple", clase: "bg-pagada text-pagada-foreground" }
      : resultado === "FALLA" && siFalla === "FRENAR"
        ? { texto: "Falla · frena", clase: "bg-frenada text-frenada-foreground" }
        : resultado === "FALLA"
          ? { texto: "Falla · escala", clase: "bg-escalada text-escalada-foreground" }
          : resultado === "INDETERMINADO"
            ? { texto: "Indeterminado", clase: "bg-escalada text-escalada-foreground" }
            : { texto: "No aplica", clase: "bg-muted text-muted-foreground" };
  return <Badge className={cn(PILDORA, clase, className)}>{texto}</Badge>;
}
