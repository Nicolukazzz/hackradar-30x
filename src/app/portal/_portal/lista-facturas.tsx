import { FileTextIcon } from "lucide-react";
import { fechaCorta, Monto, PILDORA } from "@/app/_componentes";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EstadoProveedor, FacturaProveedor } from "@/servicios/portal";

const ESTADO: Record<EstadoProveedor, { texto: string; clase: string; punto: string }> = {
  aprobada: { texto: "Aprobada para pago", clase: "bg-pagada text-pagada-foreground", punto: "bg-pagada-punto" },
  en_revision: { texto: "En revisión", clase: "bg-escalada text-escalada-foreground", punto: "bg-escalada-punto" },
  no_se_pagara: { texto: "No se pagará", clase: "bg-frenada text-frenada-foreground", punto: "bg-frenada-punto" },
  no_es_factura: { texto: "No es factura", clase: "bg-subtle text-muted-foreground", punto: "bg-muted-foreground" },
};

function Estado({ estado }: { estado: EstadoProveedor }) {
  const e = ESTADO[estado];
  return (
    <Badge className={cn(PILDORA, e.clase)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", e.punto)} />
      {e.texto}
    </Badge>
  );
}

export function ListaFacturas({ facturas }: { facturas: FacturaProveedor[] }) {
  if (facturas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <FileTextIcon aria-hidden className="size-8 text-muted-foreground" />
        <p className="font-medium">Todavía no enviaste facturas</p>
        <p className="text-sm text-muted-foreground">Cuando subas una, aquí verás su número de referencia y en qué estado está.</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {facturas.map((f) => (
        <li key={f.ref_interna} className="flex flex-col gap-2 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-col">
              <span className="font-medium">{f.factura_numero ?? "Documento sin número legible"}</span>
              <span className="text-sm text-muted-foreground">
                Ref <span className="font-mono tabular-nums">{f.ref_interna}</span> · recibida el {fechaCorta(f.recibida_en)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Monto dinero={f.monto} className="text-sm" />
              <Estado estado={f.estado} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{f.detalle}</p>
        </li>
      ))}
    </ul>
  );
}
