import { InboxIcon } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

// Placeholder de la Bandeja (especificación §13.1). La pantalla real la construye #6.
export default function BandejaPage() {
  return (
    <>
      <header className="flex flex-col gap-2">
        <span className="text-sm text-muted-foreground">Octubre 2026</span>
        <h1 className="text-3xl font-semibold tracking-tight">Bandeja de decisiones</h1>
      </header>

      <Empty className="flex-none rounded-2xl border bg-card py-20">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>Aún no hay facturas en este periodo</EmptyTitle>
          <EmptyDescription>Usa Procesar facturas nuevas para que el agente revise el lote.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </>
  );
}
