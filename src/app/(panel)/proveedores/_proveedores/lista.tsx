"use client";

import { KeyRoundIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { fechaCorta, hora } from "@/app/_componentes";
import { BotonRevocar } from "@/app/_componentes/invitacion";
import type { EnlaceConEstado } from "@/app/_datos/proveedores";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { generarCodigo } from "@/vinculos/codigo";
import type { EstadoEnlace } from "@/vinculos/tipos";

import { llamar } from "../../ajustes/equipo/_equipo/api";
import { CodigoProveedor } from "./codigo";

const ESTADO: Record<EstadoEnlace, { texto: string; clase: string }> = {
  activo: { texto: "Activo", clase: "bg-pagada text-pagada-foreground" },
  vencido: { texto: "Vencido", clase: "bg-muted text-muted-foreground" },
  revocado: { texto: "Revocado", clase: "bg-frenada text-frenada-foreground" },
};

/** «Nuevo código»: confirma, genera uno, lo guarda y lo muestra una vez. El anterior deja de servir. */
function NuevoCodigo({ id, nombre }: { id: string; nombre: string }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [codigo, setCodigo] = useState<string | null>(null);
  function cambiar() {
    iniciar(async () => {
      try {
        const r = await llamar<{ codigo: string }>(`/api/proveedores/enlaces/${id}/codigo`, "POST", { codigo: generarCodigo() });
        setCodigo(r.codigo);
      } catch (e) {
        toast.error("No se cambió el código", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }
  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="ghost" className="h-11 gap-1.5 px-3" disabled={ocupado} />}>
          {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : <KeyRoundIcon aria-hidden />}
          Nuevo código
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar el código de {nombre}?</AlertDialogTitle>
            <AlertDialogDescription>El código actual deja de servir al instante y su sesión abierta se cierra. El enlace sigue siendo el mismo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={cambiar}>Cambiar código</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={codigo !== null}
        onOpenChange={(a) => {
          if (a) return;
          setCodigo(null);
          router.refresh();
        }}
      >
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Código nuevo</DialogTitle>
            <DialogDescription>Pásaselo a {nombre}. Por seguridad no se vuelve a mostrar.</DialogDescription>
          </DialogHeader>
          {codigo ? <CodigoProveedor codigo={codigo} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ListaEnlaces({ enlaces, puedeRevocar }: { enlaces: EnlaceConEstado[]; puedeRevocar: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4 md:pl-6">Proveedor</TableHead>
          <TableHead className="hidden md:table-cell">Último ingreso</TableHead>
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
                <span className="text-xs break-all text-muted-foreground">{e.correo}</span>
                <span className="text-xs text-muted-foreground">{e.beneficiario_id ? "Correo de un proveedor de la lista" : "Proveedor nuevo"}</span>
              </span>
            </TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">{e.ultimo_acceso ? `${fechaCorta(e.ultimo_acceso)}, ${hora(e.ultimo_acceso)}` : "Todavía no entra"}</TableCell>
            <TableCell>
              <span className="flex flex-col gap-0.5">
                <Badge className={cn("w-fit", ESTADO[e.estado].clase)}>{ESTADO[e.estado].texto}</Badge>
                {e.estado === "activo" ? (
                  <span className="text-xs text-muted-foreground">
                    vence {fechaCorta(e.expira_en)}, {hora(e.expira_en)}
                  </span>
                ) : null}
              </span>
            </TableCell>
            <TableCell className="pr-2 text-right md:pr-6">
              {puedeRevocar && e.estado === "activo" ? (
                <span className="inline-flex flex-wrap justify-end gap-1">
                  <NuevoCodigo id={e.id} nombre={e.nombre} />
                  <BotonRevocar url={`/api/proveedores/enlaces/${e.id}`} exito="El proveedor ya no puede entrar." />
                </span>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
