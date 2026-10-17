"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

/** "Ordenar por" de Aprobaciones (§13.3): vive en ?orden= para que el servidor ordene. */
export function OrdenAprobaciones({ orden }: { orden: "vencimiento" | "monto" }) {
  const router = useRouter();
  const ruta = usePathname();
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="orden-aprobaciones" className="text-xs text-muted-foreground">
        Ordenar por
      </label>
      <select
        id="orden-aprobaciones"
        value={orden}
        aria-busy={pendiente}
        onChange={(e) => iniciar(() => router.replace(e.target.value === "monto" ? `${ruta}?orden=monto` : ruta, { scroll: false }))}
        className="min-h-11 rounded-[10px] border border-borde-fuerte bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="vencimiento">Vencimiento más próximo</option>
        <option value="monto">Monto más alto</option>
      </select>
    </div>
  );
}
