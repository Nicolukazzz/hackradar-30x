"use client";

import { SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

// Filtros del Registro (§13.5): buscar, decisión y quién decidió. Viven en la URL (?q=&decision=&actor=)
// para que un enlace muestre lo mismo; el buscador espera 300 ms antes de navegar.

const CAMPO =
  "min-h-11 rounded-[10px] border border-borde-fuerte bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function FiltrosRegistro({ q, decision, actor }: { q: string; decision: string; actor: string }) {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const [texto, setTexto] = useState(q);
  const [pendiente, iniciar] = useTransition();
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(espera.current), []);

  function ir(cambios: Record<string, string>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v && v !== "todas" && v !== "todos") p.set(k, v);
      else p.delete(k);
    }
    // La entrada seleccionada puede no estar en el resultado nuevo.
    p.delete("entrada");
    const s = p.toString();
    iniciar(() => router.replace(s ? `${ruta}?${s}` : ruta, { scroll: false }));
  }

  return (
    <form
      role="search"
      aria-busy={pendiente}
      className={cn("flex flex-wrap items-end gap-3 transition-opacity", pendiente && "opacity-70")}
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(espera.current);
        ir({ q: texto.trim() });
      }}
    >
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
        <label htmlFor="registro-q" className="text-xs text-muted-foreground">
          Buscar
        </label>
        <div className="relative">
          <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="registro-q"
            type="search"
            value={texto}
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
            placeholder="Factura, beneficiario o regla (ej. R4)"
            className={cn(CAMPO, "w-full pl-9")}
            onChange={(e) => {
              const v = e.target.value;
              setTexto(v);
              clearTimeout(espera.current);
              espera.current = setTimeout(() => ir({ q: v.trim() }), 300);
            }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="registro-decision" className="text-xs text-muted-foreground">
          Decisión
        </label>
        <select id="registro-decision" value={decision} className={CAMPO} onChange={(e) => ir({ decision: e.target.value })}>
          <option value="todas">Todas</option>
          <option value="pagar">Pagadas</option>
          <option value="frenar">Frenadas</option>
          <option value="escalar">Escaladas</option>
          <option value="humanas">Decisiones humanas</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="registro-actor" className="text-xs text-muted-foreground">
          Quién decidió
        </label>
        <select id="registro-actor" value={actor} className={CAMPO} onChange={(e) => ir({ actor: e.target.value })}>
          <option value="todos">Agente y personas</option>
          <option value="agente">Solo el agente</option>
          <option value="humano">Solo personas</option>
        </select>
      </div>
    </form>
  );
}
