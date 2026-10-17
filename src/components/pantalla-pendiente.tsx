import type { LucideIcon } from "lucide-react";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// Placeholder común mientras #6 construye cada pantalla (especificación §13).
export function PantallaPendiente({
  contexto,
  titulo,
  icono: Icono,
  vacioTitulo,
  vacioDescripcion,
}: {
  contexto: string;
  titulo: string;
  icono: LucideIcon;
  vacioTitulo: string;
  vacioDescripcion: string;
}) {
  return (
    <>
      <header className="flex flex-col gap-2">
        <span className="text-sm text-muted-foreground">{contexto}</span>
        <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
      </header>

      <Empty className="flex-none rounded-2xl border bg-card py-20">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icono />
          </EmptyMedia>
          <EmptyTitle>{vacioTitulo}</EmptyTitle>
          <EmptyDescription>{vacioDescripcion}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </>
  );
}
