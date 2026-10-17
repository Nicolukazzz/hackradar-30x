import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Tarjeta del prototipo: superficie blanca, borde #E3E6E1, radio 16 px, sin sombra pesada.

export function Tarjeta({ className, ...props }: React.ComponentProps<typeof Card>) {
  return <Card className={cn("gap-0 rounded-2xl py-0 shadow-none ring-1 ring-border", className)} {...props} />;
}

/** Cabecera de tarjeta: título (h2) + descripción a la izquierda, acciones a la derecha. */
export function TarjetaEncabezado({
  titulo,
  descripcion,
  id,
  children,
  className,
}: {
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  /** id del h2, para `aria-labelledby` de la sección */
  id?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3.5 px-6 py-5", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id={id} className="text-[17px] font-semibold tracking-tight text-balance">
          {titulo}
        </h2>
        {descripcion ? <p className="text-[13px] text-muted-foreground">{descripcion}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

/** Pie gris de tarjeta ("Cómo combina las reglas", notas). */
export function TarjetaPie({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("border-t border-border bg-superficie-2 px-6 py-3.5 text-[13px] text-muted-foreground", className)} {...props} />;
}
