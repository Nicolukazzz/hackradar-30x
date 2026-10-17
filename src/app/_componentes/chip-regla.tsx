import { cn } from "@/lib/utils";

// Chip de comparación de una regla (§9 `comparaciones`, §13.3, §13.5): "R9 · 4.500,00 > 3.000,00".
// neutro = registro y bandeja · escalar/frenar = tarjetas de aprobación (id en mono + texto corto).

const TONOS = {
  neutro: "rounded-md bg-chip text-texto-3 font-mono",
  escalar: "rounded-full bg-escalada text-escalada-foreground font-semibold",
  frenar: "rounded-full bg-frenada text-frenada-foreground font-semibold",
} as const;

export function ChipRegla({
  id,
  texto,
  tono = "neutro",
  className,
}: {
  /** "R9". Si `texto` ya trae el id ("R9 · 4.500,00 > 3.000,00"), omitirlo. */
  id?: string;
  texto?: string;
  tono?: keyof typeof TONOS;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 text-xs leading-5 whitespace-nowrap", TONOS[tono], className)}>
      {id ? <span className="font-mono">{id}</span> : null}
      {id && texto && tono === "neutro" ? <span aria-hidden>·</span> : null}
      {texto}
    </span>
  );
}
