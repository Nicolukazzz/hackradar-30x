"use client";

import { fechaCorta, hora } from "@/app/_componentes";
import { BotonRevocar } from "@/app/_componentes/invitacion";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InvitacionConEstado } from "@/invitaciones/servicio";
import type { EstadoInvitacionProveedor } from "@/invitaciones/tipos";
import { cn } from "@/lib/utils";

const ESTADO: Record<EstadoInvitacionProveedor, { texto: string; clase: string }> = {
  activa: { texto: "Activa", clase: "bg-pagada text-pagada-foreground" },
  agotada: { texto: "Sin envíos", clase: "bg-muted text-muted-foreground" },
  vencida: { texto: "Vencida", clase: "bg-muted text-muted-foreground" },
  revocada: { texto: "Revocada", clase: "bg-frenada text-frenada-foreground" },
};


export function ListaInvitaciones({ invitaciones }: { invitaciones: InvitacionConEstado[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4 md:pl-6">Proveedor</TableHead>
          <TableHead className="hidden md:table-cell">Creado</TableHead>
          <TableHead>Envíos</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="pr-6 text-right">
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitaciones.map((i) => (
          <TableRow key={i.id}>
            <TableCell className="pl-4 md:pl-6">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{i.nombre_esperado ?? "Proveedor nuevo"}</span>
                <span className="text-xs text-muted-foreground">{i.correo_esperado ?? "Cualquier cuenta"}</span>
              </span>
            </TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">{fechaCorta(i.creada_en)}</TableCell>
            <TableCell className="font-mono tabular-nums">
              {i.usos} de {i.usos_max}
            </TableCell>
            <TableCell>
              <span className="flex flex-col gap-0.5">
                <Badge className={cn("w-fit", ESTADO[i.estado].clase)}>{ESTADO[i.estado].texto}</Badge>
                {i.estado === "activa" ? (
                  <span className="text-xs text-muted-foreground">
                    vence {fechaCorta(i.expira_en)}, {hora(i.expira_en)}
                  </span>
                ) : null}
              </span>
            </TableCell>
            <TableCell className="pr-2 text-right md:pr-6">{i.estado === "activa" ? <BotonRevocar url={`/api/invitaciones-proveedor/${i.id}`} exito="Ya no sirve para enviar facturas." /> : null}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
