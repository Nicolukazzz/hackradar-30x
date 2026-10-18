"use client";

import { SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { mesAnio } from "@/app/_componentes/formato";
import type { FiltroDecision } from "@/app/_datos/bandeja";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Filtros de la Bandeja (#119) en una sola fila: periodo, estado y búsqueda. Viven en la URL (se pueden compartir y el
// botón Atrás funciona) y cambian al instante, sin botón de «aplicar».

const ESTADOS: { id: FiltroDecision; texto: string }[] = [
  { id: "todas", texto: "Todas" },
  { id: "pagar", texto: "Pagadas" },
  { id: "frenar", texto: "Frenadas" },
  { id: "escalar", texto: "Escaladas" },
];

export function FiltrosBandeja({ meses, conteos }: { meses: string[]; conteos: Record<FiltroDecision, number> }) {
  const router = useRouter();
  const ruta = usePathname();
  const sp = useSearchParams();
  const [, iniciar] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const mes = sp.get("mes") ?? "todos";
  const decision = (sp.get("decision") as FiltroDecision | null) ?? "todas";

  function ir(cambios: Record<string, string | null>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null || v === "" || v === "todas" || v === "todos") p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    iniciar(() => router.replace(s ? `${ruta}?${s}` : ruta, { scroll: false }));
  }

  const opcionesMes = [{ value: "todos", label: "Todos los meses" }, ...meses.map((m) => ({ value: m, label: mesAnio(m) }))];

  return (
    <div className="flex flex-col gap-3 px-5 pt-5 md:flex-row md:items-center md:justify-between md:px-6">
      <div role="tablist" aria-label="Filtrar por estado" className="flex w-full overflow-x-auto rounded-[12px] bg-muted p-1 md:w-auto">
        {ESTADOS.map((e) => {
          const activa = e.id === decision;
          return (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => ir({ decision: e.id })}
              className={cn(
                "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-3.5 text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:flex-none",
                activa ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {e.texto}
              <span className="font-mono text-xs text-muted-foreground tabular-nums">{conteos[e.id]}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select items={opcionesMes} value={mes} onValueChange={(v) => v && ir({ mes: v })}>
          <SelectTrigger aria-label="Periodo" className="w-full sm:w-48 data-[size=default]:h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opcionesMes.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <form
          role="search"
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            ir({ q: q.trim() });
          }}
        >
          <label htmlFor="buscar" className="sr-only">
            Buscar factura o proveedor
          </label>
          <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="buscar"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (e.target.value === "") ir({ q: null });
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder="Buscar factura o proveedor…"
            className="min-h-11 w-full rounded-[10px] border border-borde-fuerte bg-card pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-64"
          />
        </form>
      </div>
    </div>
  );
}
