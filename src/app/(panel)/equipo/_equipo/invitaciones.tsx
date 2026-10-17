"use client";

import { Loader2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { fechaCorta, hora } from "@/app/_componentes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InvitacionConEstado } from "@/equipo/servicio";
import type { EstadoInvitacion } from "@/equipo/tipos";
import { NOMBRE_ROL } from "@/lib/auth/permisos";
import { cn } from "@/lib/utils";

import { llamar } from "./api";

const ESTADO: Record<EstadoInvitacion, { texto: string; clase: string }> = {
  activa: { texto: "Activa", clase: "bg-pagada text-pagada-foreground" },
  usada: { texto: "Usada", clase: "bg-muted text-muted-foreground" },
  vencida: { texto: "Vencida", clase: "bg-muted text-muted-foreground" },
  revocada: { texto: "Revocada", clase: "bg-frenada text-frenada-foreground" },
};

function Revocar({ id }: { id: string }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  function revocar() {
    iniciar(async () => {
      try {
        await llamar(`/api/equipo/invitaciones/${id}`, "DELETE");
        toast.success("Invitación revocada", { description: "El enlace ya no sirve." });
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
            <TableCell className="pr-2 text-right md:pr-6">{i.estado === "activa" ? <Revocar id={i.id} /> : null}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
