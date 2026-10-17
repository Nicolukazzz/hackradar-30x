"use client";

import { Loader2Icon, PencilIcon, UserMinusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Boton, fechaCorta } from "@/app/_componentes";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatearUsd } from "@/dominio/dinero";
import type { Miembro } from "@/equipo/tipos";
import { NOMBRE_ROL, type Rol } from "@/lib/auth/permisos";

import { llamar, usdACentavos } from "./api";
import { ElegirRol } from "./elegir-rol";

function textoLimite(m: Pick<Miembro, "rol" | "limite_aprobacion_usd">): string {
  if (m.rol === "tesoreria") return "No aprueba";
  if (m.rol === "admin" || m.limite_aprobacion_usd === null) return "Sin límite";
  return `USD ${formatearUsd(m.limite_aprobacion_usd)}`;
}

function Editar({ miembro, alTerminar }: { miembro: Miembro; alTerminar: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [rol, setRol] = useState<Rol>(miembro.rol);
  const [limite, setLimite] = useState(miembro.limite_aprobacion_usd === null ? "" : formatearUsd(miembro.limite_aprobacion_usd));
  const [ocupado, iniciar] = useTransition();
  const centavos = rol === "aprobador" ? usdACentavos(limite) : null;
  const invalido = Number.isNaN(centavos) || centavos === 0;

  function guardar() {
    iniciar(async () => {
      try {
        await llamar(`/api/equipo/miembros/${miembro.usuario_id}`, "PATCH", { rol, limite_aprobacion_usd: centavos });
        toast.success("Rol actualizado", { description: `${miembro.nombre} ahora es ${NOMBRE_ROL[rol]}.` });
        setAbierto(false);
        alTerminar();
      } catch (e) {
        toast.error("No se cambió el rol", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  return (
    <>
      <Button variant="ghost" size="icon" className="size-11" aria-label={`Cambiar rol de ${miembro.nombre}`} onClick={() => setAbierto(true)}>
        <PencilIcon aria-hidden />
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Rol de {miembro.nombre}</DialogTitle>
            <DialogDescription>El cambio aplica desde su próxima acción; no toca lo que ya decidió.</DialogDescription>
          </DialogHeader>
          <ElegirRol valor={rol} onCambio={setRol} nombre={`rol-${miembro.usuario_id}`} />
          {rol === "aprobador" ? (
            <Field data-invalid={invalido || undefined}>
              <FieldLabel htmlFor={`limite-${miembro.usuario_id}`}>Límite por pago (USD)</FieldLabel>
              <Input
                id={`limite-${miembro.usuario_id}`}
                inputMode="decimal"
                placeholder="Sin límite"
                value={limite}
                onChange={(e) => setLimite(e.target.value)}
                aria-invalid={invalido || undefined}
                className="h-11 font-mono tabular-nums"
              />
              {invalido ? <FieldError>Escribe un monto como 5.000 o déjalo vacío.</FieldError> : <FieldDescription>Vacío = cualquier monto.</FieldDescription>}
            </Field>
          ) : null}
          <DialogFooter className="-mx-6 -mb-6 px-6">
            <Boton variante="secundaria" onClick={() => setAbierto(false)} disabled={ocupado}>
              Cancelar
            </Boton>
            <Boton variante="primaria" onClick={guardar} disabled={ocupado || invalido}>
              {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
              Guardar
            </Boton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Quitar({ miembro, esYo, alTerminar }: { miembro: Miembro; esYo: boolean; alTerminar: () => void }) {
  const [ocupado, iniciar] = useTransition();
  const router = useRouter();

  function quitar() {
    iniciar(async () => {
      try {
        await llamar(`/api/equipo/miembros/${miembro.usuario_id}`, "DELETE");
        toast.success(esYo ? "Saliste del equipo" : `${miembro.nombre} ya no está en el equipo`);
        if (esYo) router.push("/sin-permiso");
        else alTerminar();
      } catch (e) {
        toast.error("No se pudo quitar", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-11 text-muted-foreground hover:text-frenada-foreground"
            aria-label={`Quitar a ${miembro.nombre} del equipo`}
          />
        }
      >
        <UserMinusIcon aria-hidden />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{esYo ? "¿Salir del equipo?" : `¿Quitar a ${miembro.nombre}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {esYo
              ? "Perderás el acceso al panel en cuanto confirmes. Para volver necesitarás una invitación nueva."
              : "Pierde el acceso al panel al instante. Su cuenta sigue existiendo y lo que ya decidió queda en el registro."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11" disabled={ocupado}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction className="h-11" variant="peligro" onClick={quitar} disabled={ocupado}>
            {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
            {esYo ? "Salir" : "Quitar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Miembros({ miembros, yo }: { miembros: Miembro[]; yo: string }) {
  const router = useRouter();
  const refrescar = () => router.refresh();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4 md:pl-6">Persona</TableHead>
          <TableHead className="hidden md:table-cell">Rol</TableHead>
          <TableHead className="hidden md:table-cell">Aprueba hasta</TableHead>
          <TableHead className="hidden md:table-cell">Desde</TableHead>
          <TableHead className="pr-6 text-right">
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {miembros.map((m) => (
          <TableRow key={m.usuario_id}>
            <TableCell className="pl-4 whitespace-normal md:pl-6">
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">
                  {m.nombre}
                  {m.usuario_id === yo ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(tú)</span> : null}
                </span>
                <span className="text-xs break-all whitespace-normal text-muted-foreground">{m.correo}</span>
                {/* En móvil, rol y límite van aquí y sus columnas se ocultan: las acciones quedan a la vista. */}
                <span className="mt-1 text-xs text-muted-foreground md:hidden">
                  {NOMBRE_ROL[m.rol]} · {textoLimite(m)}
                </span>
                {!m.activo ? <span className="text-xs text-frenada-foreground">Cuenta desactivada</span> : null}
              </span>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <Badge variant={m.rol === "admin" ? "default" : "secondary"}>{NOMBRE_ROL[m.rol]}</Badge>
            </TableCell>
            <TableCell className="hidden font-mono text-[13px] tabular-nums md:table-cell">{textoLimite(m)}</TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">{fechaCorta(m.desde)}</TableCell>
            <TableCell className="pr-4 md:pr-6">
              <span className="flex justify-end gap-1">
                <Editar miembro={m} alTerminar={refrescar} />
                <Quitar miembro={m} esYo={m.usuario_id === yo} alTerminar={refrescar} />
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
