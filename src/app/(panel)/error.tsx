"use client";

import { TriangleAlertIcon } from "lucide-react";

import { Boton } from "@/app/_componentes";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// Error al leer datos de una pantalla del panel. No muestra detalles internos; nada se pagó ni se registró a medias.
export default function ErrorPanel({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Empty className="flex-none rounded-2xl border bg-card py-20">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No pudimos cargar esta pantalla</EmptyTitle>
        <EmptyDescription>Puede ser la conexión con la base de datos. Nada se pagó ni se registró a medias.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Boton variante="primaria" onClick={reset}>
          Intentar de nuevo
        </Boton>
      </EmptyContent>
    </Empty>
  );
}
