"use client";

import { Loader2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { fechaCorta, hora } from "@/app/_componentes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InvitacionConEstado } from "@/invitaciones/servicio";
import type { EstadoInvitacionProveedor } from "@/invitaciones/tipos";
import { cn } from "@/lib/utils";

import { llamar } from "../../equipo/_equipo/api";

const ESTADO: Record<EstadoInvitacionProveedor, { texto: string; clase: string }> = {
  activa: { texto: "Activa", clase: "bg-pagada text-pagada-foreground" },
  agotada: { texto: "Sin envíos", clase: "bg-muted text-muted-foreground" },
  vencida: { texto: "Vencida", clase: "bg-muted text-muted-foreground" },
  revocada: { texto: "Revocada", clase: "bg-frenada text-frenada-foreground" },
};

function Revocar({ id }: { id: string }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  function revocar() {
    iniciar(async () => {
      try {
        await llamar(`/api/invitaciones-proveedor/${id}`, "DELETE");
        toast.success("Enlace revocado", { description: "Ya no sirve para enviar facturas." });
        router.refresh();
      } catch (e) {
        toast.error("No se pudo revocar", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }
  return (
    <Button variant="ghost" className="h-11 gap-1.5 px-3" onClick={revocar} disabled={ocupado}>
      {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : <XIcon aria-hidden />}
      Revocar
    </Button>
  );
}

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
            <TableCell className="pr-2 text-right md:pr-6">{i.estado === "activa" ? <Revocar id={i.id} /> : null}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
