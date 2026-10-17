"use client";

import { Loader2Icon, MailIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { fechaCorta, hora } from "@/app/_componentes";
import { BotonRevocar } from "@/app/_componentes/invitacion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InvitacionConEstado } from "@/equipo/servicio";
import type { EstadoInvitacion } from "@/equipo/tipos";
import { NOMBRE_ROL } from "@/lib/auth/permisos";
import { cn } from "@/lib/utils";

/** Reenviar (#80): revoca el enlace y manda uno nuevo al mismo correo. */
function Reenviar({ id }: { id: string }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  function reenviar() {
    iniciar(async () => {
      const res = await fetch(`/api/equipo/invitaciones/${id}/reenviar`, { method: "POST" });
      const datos = (await res.json().catch(() => ({}))) as { correo_enviado?: boolean; error?: string };
      if (!res.ok) {
        toast.error("No se pudo reenviar", { description: datos.error ?? "Intenta de nuevo." });
        return;
      }
      toast.success(datos.correo_enviado ? "Correo reenviado" : "Enlace nuevo creado", {
        description: datos.correo_enviado ? "El enlace anterior ya no sirve." : "No hay buzón configurado: crea el empleado de nuevo para copiar el enlace.",
      });
      router.refresh();
    });
  }
  return (
    <Button variant="ghost" className="h-11 gap-1.5 px-3" onClick={reenviar} disabled={ocupado}>
      {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : <MailIcon aria-hidden />}
      Reenviar
    </Button>
  );
}

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
          <TableHead className="hidden sm:table-cell">Correo</TableHead>
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
            <TableCell className="hidden text-muted-foreground sm:table-cell">{i.correo_esperado ?? "Cualquier cuenta (enlace anterior)"}</TableCell>
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
            <TableCell className="pr-2 text-right md:pr-6">
              {i.estado === "activa" || i.estado === "vencida" ? (
                <span className="inline-flex flex-wrap justify-end gap-1">
                  {i.correo_esperado && i.estado === "activa" ? <Reenviar id={i.id} /> : null}
                  {i.estado === "activa" ? <BotonRevocar url={`/api/equipo/invitaciones/${i.id}`} exito="El enlace ya no sirve." /> : null}
                </span>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
