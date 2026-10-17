"use client";

import { TriangleAlertIcon } from "lucide-react";

import { Boton } from "@/app/_componentes";

/** Si no se pudo cargar el portal: mensaje claro y reintentar, nunca la página de error genérica. */
export default function ErrorPortal({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <TriangleAlertIcon aria-hidden className="size-8 text-frenada-foreground" />
      <h1 className="text-xl font-semibold">No pudimos cargar tus facturas</h1>
      <p className="text-muted-foreground">Tus envíos no se perdieron. Intenta de nuevo en un momento.</p>
      <Boton variante="primaria" onClick={reset}>
        Intentar de nuevo
      </Boton>
    </main>
  );
}
