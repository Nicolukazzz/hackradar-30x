"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

// Bandeja en vivo: cada 15 s (solo con la pestaña visible) pregunta si el agente decidió algo nuevo. Si sí, refresca la
// pantalla sin perder el scroll y avisa «Llegó una factura nueva» con un enlace a su traza.

const CADA_MS = 15_000;

type Novedades = { total: number; ultima: string | null };

export function BandejaEnVivo({ inicial }: { readonly inicial: Novedades }) {
  const router = useRouter();
  const visto = useRef(inicial.total);

  useEffect(() => {
    visto.current = Math.max(visto.current, inicial.total);
  }, [inicial.total]);

  useEffect(() => {
    let vivo = true;
    async function revisar() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/bandeja/novedades", { cache: "no-store" });
        if (!res.ok || !vivo) return;
        const n = (await res.json()) as Novedades;
        const nuevas = n.total - visto.current;
        if (nuevas <= 0) return;
        visto.current = n.total;
        router.refresh();
        toast.info(nuevas === 1 ? "Llegó una factura nueva" : `Llegaron ${nuevas} facturas nuevas`, {
          description: "El agente ya la revisó. La bandeja se actualizó.",
          action: n.ultima ? { label: "Ver", onClick: () => router.push(`/facturas/${encodeURIComponent(n.ultima!)}`) } : undefined,
        });
      } catch {
        // Sin red: se reintenta en la próxima vuelta, sin molestar.
      }
    }
    const t = setInterval(revisar, CADA_MS);
    document.addEventListener("visibilitychange", revisar);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", revisar);
    };
  }, [router]);

  return null;
}
