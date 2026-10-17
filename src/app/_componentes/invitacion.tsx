"use client";

import { CheckIcon, CopyIcon, Loader2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Boton } from "./boton";

// Piezas comunes de los enlaces: equipo (#51, /ajustes/equipo) y proveedores (#85, /proveedores).

export type Opcion = { value: string; label: string };

export const VIGENCIAS: Opcion[] = [
  { value: "1", label: "1 día" },
  { value: "7", label: "7 días" },
  { value: "14", label: "14 días" },
  { value: "30", label: "30 días" },
];

/** Select de opciones fijas (vence en, número de envíos), alto táctil. */
export function SelectorOpciones({ id, opciones, valor, onCambio }: { id: string; opciones: Opcion[]; valor: string; onCambio: (v: string) => void }) {
  return (
    <Select items={opciones} value={valor} onValueChange={(v) => v && onCambio(v)}>
      <SelectTrigger id={id} className="w-full data-[size=default]:h-11">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opciones.map((v) => (
          <SelectItem key={v.value} value={v.value}>
            {v.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Enlace recién creado (solo se ve una vez) con su resumen debajo. */
export function EnlaceGenerado({ enlace, etiqueta, resumen }: { enlace: string; etiqueta: string; resumen: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Input readOnly value={enlace} aria-label={etiqueta} onFocus={(e) => e.target.select()} className="h-11 font-mono text-xs" />
      <p className="text-[13px] text-muted-foreground">{resumen}</p>
    </div>
  );
}

/** "Copiar enlace" con su toast; el texto de éxito dice a quién mandarlo. */
export function BotonCopiar({ enlace, descripcion, texto = "Copiar enlace" }: { enlace: string; descripcion: string; texto?: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      toast.success(texto === "Copiar enlace" ? "Enlace copiado" : "Copiado", { description: descripcion });
    } catch {
      toast.error("No se pudo copiar", { description: "Selecciona el enlace y cópialo a mano." });
    }
  }
  return (
    <Boton variante="primaria" onClick={copiar}>
      {copiado ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      {copiado ? "Copiado" : texto}
    </Boton>
  );
}

/** Revocar un enlace (DELETE a `url`) y refrescar la lista. */
export function BotonRevocar({ url, exito }: { url: string; exito: string }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  function revocar() {
    iniciar(async () => {
      const res = await fetch(url, { method: "DELETE" });
      const datos = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error("No se pudo revocar", { description: datos.error ?? "Intenta de nuevo." });
        return;
      }
      toast.success("Enlace revocado", { description: exito });
      router.refresh();
    });
  }
  return (
    <Button variant="ghost" className="h-11 gap-1.5 px-3" onClick={revocar} disabled={ocupado}>
      {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : <XIcon aria-hidden />}
      Revocar
    </Button>
  );
}
