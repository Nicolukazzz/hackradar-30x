"use client";

import { Loader2Icon, MailIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { fechaCorta, hora } from "@/app/_componentes";
import { BotonCopiar, BotonRevocar, EnlaceGenerado } from "@/app/_componentes/invitacion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InvitacionConEstado } from "@/equipo/servicio";
import type { EstadoInvitacion } from "@/equipo/tipos";
import { NOMBRE_ROL } from "@/lib/auth/permisos";
import { cn } from "@/lib/utils";

/**
 * Reenviar (#80): pide confirmar (el enlace actual deja de servir), crea uno nuevo y lo envía al mismo correo. Si el
 * correo no sale, muestra el enlace nuevo para copiarlo: es la única vez que existe.
 */
function Reenviar({ id, correo }: { id: string; correo: string }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [enlace, setEnlace] = useState<string | null>(null);
  function reenviar() {
    iniciar(async () => {
      const res = await fetch(`/api/equipo/invitaciones/${id}/reenviar`, { method: "POST" });
      const datos = (await res.json().catch(() => ({}))) as { correo_enviado?: boolean; enlace?: string; error?: string };
      if (!res.ok) {
        toast.error("No se pudo reenviar", { description: datos.error ?? "Intenta de nuevo." });
        return;
      }
      if (datos.correo_enviado) {
        toast.success("Correo reenviado", { description: `${correo} recibió un enlace nuevo; el anterior ya no sirve.` });
        router.refresh();
      } else {
        // Se refresca al cerrar: refrescar ahora desmonta esta fila (ya revocada) y el enlace se perdería.
        setEnlace(datos.enlace ?? null);
      }
    });
  }
  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="ghost" className="h-11 gap-1.5 px-3" disabled={ocupado} />}>
          {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : <MailIcon aria-hidden />}
          Reenviar
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reenviar el correo a {correo}?</AlertDialogTitle>
            <AlertDialogDescription>Le llega un enlace nuevo que vence en 72 horas. El enlace que ya tiene deja de servir.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={reenviar}>Reenviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={enlace !== null}
        onOpenChange={(a) => {
          if (a) return;
          setEnlace(null);
          router.refresh();
        }}
      >
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enlace nuevo</DialogTitle>
            <DialogDescription>No hay buzón de correo configurado: copia el enlace y envíaselo a {correo}. Por seguridad no se vuelve a mostrar.</DialogDescription>
          </DialogHeader>
          {enlace ? <EnlaceGenerado enlace={enlace} etiqueta="Enlace para crear la cuenta" resumen={`Solo ${correo} · vence en 72 horas`} /> : null}
          <DialogFooter className="-mx-6 -mb-6 px-6">{enlace ? <BotonCopiar enlace={enlace} descripcion="Envíaselo por un medio seguro." /> : null}</DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
              {i.estado === "activa" ? (
                <span className="inline-flex flex-wrap justify-end gap-1">
                  {i.correo_esperado ? <Reenviar id={i.id} correo={i.correo_esperado} /> : null}
                  <BotonRevocar url={`/api/equipo/invitaciones/${i.id}`} exito="El enlace ya no sirve." />
                </span>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
