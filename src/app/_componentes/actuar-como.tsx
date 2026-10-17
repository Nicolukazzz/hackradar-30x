"use client";

import { UserRoundIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { formatearUsd } from "@/dominio/dinero";
import { cn } from "@/lib/utils";

export type AprobadorCorto = { id: string; nombre: string; rol: string; iniciales: string; limite_usd: number | null; principal: boolean };

/**
 * "Actuar como" (demo sin login, §13.3): elige con qué aprobador se decide. Guarda la elección en una
 * cookie del servidor (POST /api/demo/actuar-como). #25 lo reemplaza por la sesión real.
 */
export function ActuarComo({ actual, aprobadores, className }: { actual: AprobadorCorto | null; aprobadores: AprobadorCorto[]; className?: string }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();

  function elegir(a: AprobadorCorto) {
    if (a.id === actual?.id) return;
    iniciar(async () => {
      const res = await fetch("/api/demo/actuar-como", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aprobador_id: a.id }),
      });
      if (!res.ok) {
        toast.error("No se pudo cambiar de aprobador", { description: ((await res.json().catch(() => ({}))) as { error?: string }).error });
        return;
      }
      toast.success(`Ahora actúas como ${a.nombre}`);
      router.refresh();
    });
  }

  return (
    <fieldset className={cn("flex flex-col gap-2", className)} aria-busy={ocupado}>
      <legend className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserRoundIcon className="size-3.5" aria-hidden />
        Actuar como (demo sin login)
      </legend>
      <div className="flex flex-wrap gap-2">
        {aprobadores.map((a) => {
          const activo = a.id === actual?.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => elegir(a)}
              disabled={ocupado}
              aria-pressed={activo}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-[10px] border px-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
                activo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
              )}
            >
              <span
                aria-hidden
                className={cn("flex size-7 items-center justify-center rounded-full font-mono text-xs font-semibold", activo ? "bg-brand text-brand-foreground" : "bg-muted")}
              >
                {a.iniciales}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-medium">{a.nombre}</span>
                <span className={cn("text-xs", activo ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {a.rol} · {a.limite_usd === null ? "sin límite" : `hasta USD ${formatearUsd(a.limite_usd)}`}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
