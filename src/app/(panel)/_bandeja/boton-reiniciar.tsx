"use client";

import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Boton } from "@/app/_componentes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** "Reiniciar demo" (#76): POST /api/demo/reiniciar abre una corrida nueva. Solo admin con modo demo. */
export function BotonReiniciar() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [ocupado, iniciar] = useTransition();

  function reiniciar() {
    iniciar(async () => {
      try {
        const res = await fetch("/api/demo/reiniciar", { method: "POST" });
        const datos = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(datos.error ?? "No se pudo reiniciar la demo.");
        setAbierto(false);
        toast.success("Demo reiniciada", { description: "Corrida nueva lista. Usa Procesar facturas nuevas para volver a decidir el lote." });
        router.refresh();
      } catch (e) {
        toast.error("No se pudo reiniciar", { description: e instanceof Error ? e.message : "Intenta de nuevo." });
      }
    });
  }

  return (
    <AlertDialog open={abierto} onOpenChange={(v) => !ocupado && setAbierto(v)}>
      <AlertDialogTrigger render={<Boton variante="secundaria" />}>
        <RotateCcwIcon aria-hidden />
        Reiniciar demo
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Reiniciar la demo?</AlertDialogTitle>
          <AlertDialogDescription>
            Empieza una corrida nueva: el lote vuelve a quedar sin procesar, con las reglas v7 y las refs desde INT-2026-000001. La corrida anterior
            queda guardada y no se borra. Los chats de Telegram vinculados se mantienen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11" disabled={ocupado}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction className="h-11" onClick={reiniciar} disabled={ocupado}>
            {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
            {ocupado ? "Reiniciando…" : "Empezar corrida nueva"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
