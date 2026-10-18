"use client";

import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

// Indicador «En vivo» de la Bandeja (#119). La revisión cada 15 s y el aviso de facturas nuevas los hace
// `BandejaEnVivo` (#125); este botón solo actualiza en el momento.

export function AutoActualizar() {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  return (
    <button
      type="button"
      onClick={() => iniciar(() => router.refresh())}
      className="inline-flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-[13px] text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label="En vivo. Actualizar ahora"
    >
      <span aria-hidden className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-pagada-punto opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2 rounded-full bg-pagada-punto" />
      </span>
      En vivo
      <RefreshCwIcon aria-hidden className={cn("size-4", ocupado && "animate-spin")} />
    </button>
  );
}
