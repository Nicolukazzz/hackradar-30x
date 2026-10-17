"use client";

import { CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** El código del proveedor en grande, con «Copiar» y, si se pasa `onOtro`, «Generar otro». */
export function CodigoProveedor({ codigo, onOtro, deshabilitado }: { codigo: string; onOtro?: () => void; deshabilitado?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      toast.success("Código copiado", { description: "Pásaselo al proveedor junto con el enlace." });
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("No se pudo copiar", { description: "Selecciónalo y cópialo a mano." });
    }
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-superficie-2 p-4 ring-1 ring-border">
      <span className="text-[13px] text-muted-foreground">Código del proveedor</span>
      <output className="font-mono text-2xl font-semibold tracking-[0.2em] tabular-nums select-all" aria-live="polite">
        {codigo}
      </output>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-11 gap-1.5" onClick={copiar}>
          {copiado ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
          {copiado ? "Copiado" : "Copiar código"}
        </Button>
        {onOtro ? (
          <Button type="button" variant="ghost" className="h-11 gap-1.5" onClick={onOtro} disabled={deshabilitado}>
            <RefreshCwIcon aria-hidden />
            Generar otro
          </Button>
        ) : null}
      </div>
    </div>
  );
}
