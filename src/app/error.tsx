"use client";

import { TriangleAlertIcon } from "lucide-react";

import { Boton } from "@/app/_componentes";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// Error en una página fuera del panel (/entrar, /vincular, /unirse…): se muestra este aviso dentro del layout en vez
// de la página de error de Next. No muestra detalles internos.
export default function ErrorPagina({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl items-center px-4">
      <Empty className="flex-none rounded-2xl border bg-card py-20">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>No pudimos cargar esta página</EmptyTitle>
          <EmptyDescription>Intenta de nuevo en unos segundos. Nada se pagó ni se registró a medias.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Boton variante="primaria" onClick={reset}>
            Intentar de nuevo
          </Boton>
        </EmptyContent>
      </Empty>
    </main>
  );
}
