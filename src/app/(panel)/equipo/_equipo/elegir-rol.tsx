"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DESCRIPCION_ROL, NOMBRE_ROL, ROLES, type Rol } from "@/lib/auth/permisos";
import { cn } from "@/lib/utils";

/** Tres tarjetas, una por rol, con lo que puede hacer. */
export function ElegirRol({ valor, onCambio, nombre }: { valor: Rol; onCambio: (r: Rol) => void; nombre: string }) {
  return (
    <RadioGroup value={valor} onValueChange={(v) => onCambio(v as Rol)} name={nombre} aria-label="Rol" className="gap-2.5">
      {ROLES.map((rol) => (
        <label
          key={rol}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3.5 transition-colors hover:bg-superficie-2",
            valor === rol && "border-foreground/40 bg-superficie-2",
          )}
        >
          <RadioGroupItem value={rol} className="mt-0.5" />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">{NOMBRE_ROL[rol]}</span>
            <span className="text-[13px] leading-snug text-muted-foreground">{DESCRIPCION_ROL[rol]}</span>
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}
