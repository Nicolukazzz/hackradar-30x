"use client";

import { fechaCorta, hora } from "@/app/_componentes";
import { BotonRevocar } from "@/app/_componentes/invitacion";
import type { EnlaceConEstado } from "@/app/_datos/proveedores";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { EstadoEnlace } from "@/vinculos/tipos";

const ESTADO: Record<EstadoEnlace, { texto: string; clase: string }> = {
  activo: { texto: "Esperando al proveedor", clase: "bg-escalada text-escalada-foreground" },
  usado: { texto: "Vinculado", clase: "bg-pagada text-pagada-foreground" },
  vencido: { texto: "Vencido", clase: "bg-muted text-muted-foreground" },
  revocado: { texto: "Revocado", clase: "bg-frenada text-frenada-foreground" },
};

export function ListaEnlaces({ enlaces, puedeRevocar }: { enlaces: EnlaceConEstado[]; puedeRevocar: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4 md:pl-6">Proveedor</TableHead>
          <TableHead>Correo e id de conexión</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="pr-6 text-right">
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {enlaces.map((e) => (
          <TableRow key={e.id}>
            <TableCell className="pl-4 md:pl-6">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{e.nombre}</span>
                <span className="text-xs text-muted-foreground">
                  {e.beneficiario_id ? "De la lista" : "Proveedor nuevo"} · creado {fechaCorta(e.creado_en)}
                </span>
              </span>
            </TableCell>
            <TableCell>
              {e.correo && e.conexion_id ? (
                <span className="flex flex-col gap-0.5">
                  <span className="break-all">{e.correo}</span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">{e.conexion_id}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <span className="flex flex-col gap-0.5">
                <Badge className={cn("w-fit", ESTADO[e.estado].clase)}>{ESTADO[e.estado].texto}</Badge>
                {e.estado === "activo" ? (
                  <span className="text-xs text-muted-foreground">
                    vence {fechaCorta(e.expira_en)}, {hora(e.expira_en)}
                  </span>
                ) : e.estado === "usado" && e.usado_en ? (
                  <span className="text-xs text-muted-foreground">
                    {fechaCorta(e.usado_en)}, {hora(e.usado_en)}
                  </span>
                ) : null}
              </span>
            </TableCell>
            <TableCell className="pr-2 text-right md:pr-6">
              {puedeRevocar && e.estado === "activo" ? <BotonRevocar url={`/api/proveedores/enlaces/${e.id}`} exito="El proveedor ya no puede usarlo." /> : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
