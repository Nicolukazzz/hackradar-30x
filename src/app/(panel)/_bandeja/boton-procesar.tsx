"use client";

import { Loader2Icon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Boton } from "@/app/_componentes";

/** "Procesar facturas nuevas" (§13.1): POST /api/procesar y refresca la pantalla y el badge. */
export function BotonProcesar({ pendientes }: { pendientes: number }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();

  function procesar() {
    iniciar(async () => {
      try {
        const res = await fetch("/api/procesar", { method: "POST" });
        // Un 502 del proxy o una página de error de Next no traen JSON: no mostrar "Unexpected token <".
        const datos = (await res.json().catch(() => ({}))) as { procesadas?: number; resumen?: Record<string, number>; error?: string };
        if (!res.ok) throw new Error(datos.error ?? "No se pudo procesar el lote.");
        if (!datos.procesadas) {
          toast.info("No hay facturas nuevas", { description: "Todo lo recibido ya tiene una decisión." });
        } else {
          const r = datos.resumen ?? {};
          toast.success(`El agente revisó ${datos.procesadas} facturas`, {
            description: `Pagó ${r.PAGAR ?? 0}, frenó ${r.FRENAR ?? 0} y escaló ${r.ESCALAR ?? 0} a una persona.`,
          });
        }
        router.refresh();
      } catch (e) {
        toast.error("No se pudo procesar", { description: e instanceof Error ? e.message : "Intenta de nuevo." });
      }
    });
  }

  return (
    <Boton variante="primaria" onClick={procesar} disabled={ocupado} aria-describedby={pendientes > 0 ? "pendientes-procesar" : undefined}>
      {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : <PlusIcon aria-hidden />}
      {ocupado ? "Procesando…" : "Procesar facturas nuevas"}
      {pendientes > 0 ? (
        <span id="pendientes-procesar" className="rounded-full bg-brand px-1.5 font-mono text-xs text-brand-foreground">
          {pendientes}
          <span className="sr-only"> por procesar</span>
        </span>
      ) : null}
    </Boton>
  );
}
