"use client";

import { KeyRoundIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { sinPuntoDoble } from "@/dominio/normalizar";

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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generarCodigo } from "@/vinculos/codigo";

import { llamar } from "../../ajustes/equipo/_equipo/api";
import { CodigoProveedor } from "./codigo";

/** «Nuevo código»: confirma, genera uno, lo guarda y lo muestra una vez. El anterior deja de servir. */
export function NuevoCodigo({ id, nombre }: { id: string; nombre: string }) {
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
            <DialogDescription>{sinPuntoDoble(`Pásaselo a ${nombre}. Por seguridad no se vuelve a mostrar.`)}</DialogDescription>
          </DialogHeader>
          {codigo ? <CodigoProveedor codigo={codigo} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
