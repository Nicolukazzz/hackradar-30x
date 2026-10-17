"use client";

import { fechaCorta, hora } from "@/app/_componentes";
import { BotonRevocar } from "@/app/_componentes/invitacion";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InvitacionConEstado } from "@/equipo/servicio";
import type { EstadoInvitacion } from "@/equipo/tipos";
import { NOMBRE_ROL } from "@/lib/auth/permisos";
import { cn } from "@/lib/utils";

const ESTADO: Record<EstadoInvitacion, { texto: string; clase: string }> = {
  activa: { texto: "Activa", clase: "bg-pagada text-pagada-foreground" },
  usada: { texto: "Usada", clase: "bg-muted text-muted-foreground" },
  vencida: { texto: "Vencida", clase: "bg-muted text-muted-foreground" },
  revocada: { texto: "Revocada", clase: "bg-frenada text-frenada-foreground" },
};


export function Invitaciones({ invitaciones }: { invitaciones: InvitacionConEstado[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4 md:pl-6">Rol</TableHead>
          <TableHead className="hidden sm:table-cell">Para</TableHead>
          <TableHead className="hidden md:table-cell">Creada</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="pr-6 text-right">
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitaciones.map((i) => (
          <TableRow key={i.id}>
            <TableCell className="pl-4 font-medium md:pl-6">{NOMBRE_ROL[i.rol]}</TableCell>
            <TableCell className="hidden text-muted-foreground sm:table-cell">{i.correo_esperado ?? "Cualquier cuenta"}</TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">{fechaCorta(i.creada_en)}</TableCell>
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
            <TableCell className="pr-2 text-right md:pr-6">{i.estado === "activa" ? <BotonRevocar url={`/api/equipo/invitaciones/${i.id}`} exito="El enlace ya no sirve." /> : null}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
