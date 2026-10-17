"use client";

import { SearchIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Filtros del Registro (§13.5): buscar, decisión y quién decidió. Viven en la URL (?q=&decision=&actor=)
// para que un enlace muestre lo mismo; el buscador espera 300 ms antes de navegar.
// Selector nativo (accesible, sin dependencias): `select` de shadcn todavía no está en src/components/ui.

const SELECTOR =
  "min-h-11 rounded-[10px] border border-borde-fuerte bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Filtros = { q: string; decision: string; actor: string };

export function FiltrosRegistro({ q, decision, actor }: Filtros) {
  const router = useRouter();
  const ruta = usePathname();
  const [pendiente, iniciar] = useTransition();
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Valores locales: el selector no salta atrás mientras el servidor responde, y el buscador sigue a la URL
  // cuando cambia desde afuera ("Quitar filtros").
  const [local, setLocal] = useState<Filtros>({ q, decision, actor });
  const [previos, setPrevios] = useState<Filtros>({ q, decision, actor });
  if (previos.q !== q || previos.decision !== decision || previos.actor !== actor) {
    setPrevios({ q, decision, actor });
    setLocal((l) => ({ q: l.q.trim() === q ? l.q : q, decision, actor }));
  }

  useEffect(() => () => clearTimeout(espera.current), []);

  function ir(cambios: Partial<Filtros>) {
    clearTimeout(espera.current);
    // La URL actual, no la del render que programó la búsqueda: un filtro elegido entretanto no se pierde.
    const p = new URLSearchParams(window.location.search);
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
        ir({ q: local.q.trim() });
      }}
    >
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
        <Label htmlFor="registro-q" className="text-xs font-normal text-muted-foreground">
          Buscar
        </Label>
        <div className="relative">
          <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="registro-q"
            type="search"
            value={local.q}
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
            placeholder="Factura, beneficiario o regla (ej. R4)"
            className="h-11 rounded-[10px] bg-card pl-9"
            onChange={(e) => {
              const v = e.target.value;
              setLocal((l) => ({ ...l, q: v }));
              clearTimeout(espera.current);
              espera.current = setTimeout(() => ir({ q: v.trim() }), 300);
            }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="registro-decision" className="text-xs font-normal text-muted-foreground">
          Decisión
        </Label>
        <select
          id="registro-decision"
          value={local.decision}
          className={SELECTOR}
          onChange={(e) => {
            setLocal((l) => ({ ...l, decision: e.target.value }));
            ir({ decision: e.target.value, q: local.q.trim() });
          }}
        >
          <option value="todas">Todas</option>
          <option value="pagar">Pagadas</option>
          <option value="frenar">Frenadas</option>
          <option value="escalar">Escaladas</option>
          <option value="humanas">Decisiones humanas</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="registro-actor" className="text-xs font-normal text-muted-foreground">
          Quién decidió
        </Label>
        <select
          id="registro-actor"
          value={local.actor}
          className={SELECTOR}
          onChange={(e) => {
            setLocal((l) => ({ ...l, actor: e.target.value }));
            ir({ actor: e.target.value, q: local.q.trim() });
          }}
        >
          <option value="todos">Agente y personas</option>
          <option value="agente">Solo el agente</option>
          <option value="humano">Solo personas</option>
        </select>
      </div>
    </form>
  );
}
