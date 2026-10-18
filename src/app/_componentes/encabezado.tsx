import { cn } from "@/lib/utils";

// Encabezado común de las pantallas del panel (#119): la misma jerarquía en todas para que no parezcan de apps
// distintas. Título corto, una frase como mucho y las acciones a la derecha (abajo en móvil).

export function EncabezadoPagina({
  titulo,
  descripcion,
  antetitulo,
  acciones,
  className,
}: {
  titulo: string;
  /** una frase: qué responde esta pantalla */
  descripcion?: React.ReactNode;
  antetitulo?: React.ReactNode;
  acciones?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="flex max-w-[620px] min-w-0 flex-col gap-1.5">
        {antetitulo ? <span className="text-[13px] text-muted-foreground">{antetitulo}</span> : null}
        <h1 className="text-[30px] leading-tight font-semibold tracking-tight text-balance">{titulo}</h1>
        {descripcion ? <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">{descripcion}</p> : null}
      </div>
      {acciones ? <div className="flex flex-wrap items-center gap-2.5">{acciones}</div> : null}
    </header>
  );
}
