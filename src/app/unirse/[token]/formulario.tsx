"use client";

import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { MINIMO_CONTRASENA } from "@/app/entrar/estado";

import { crearCuentaYUnirme, type EstadoCrearCuenta } from "./acciones";

/** Nombre + contraseña para activar la cuenta (#80). El correo viene de la invitación y no se edita. */
export function FormularioCrearCuenta({ token, correo }: { token: string; correo: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoCrearCuenta, FormData>(crearCuentaYUnirme.bind(null, token), {});
  const [visible, setVisible] = useState(false);
  return (
    <form action={accion} className="flex w-full flex-col gap-5 text-left">
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="correo-fijo">Correo</FieldLabel>
          <Input id="correo-fijo" value={correo} readOnly className="h-11 bg-superficie-2" />
        </Field>
        <Field>
          <FieldLabel htmlFor="nombre">Tu nombre</FieldLabel>
          <Input id="nombre" name="nombre" autoComplete="name" autoFocus required maxLength={120} defaultValue={estado.nombre} className="h-11" />
          <FieldDescription>Así aparecerás en el registro y en las aprobaciones.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="contrasena">Contraseña</FieldLabel>
          <div className="relative">
            <Input id="contrasena" name="contrasena" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={MINIMO_CONTRASENA} className="h-11 pr-11" />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute top-0 right-0 flex size-11 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {visible ? <EyeOffIcon className="size-4" aria-hidden /> : <EyeIcon className="size-4" aria-hidden />}
            </button>
          </div>
          <FieldDescription>Al menos {MINIMO_CONTRASENA} caracteres.</FieldDescription>
        </Field>
      </FieldGroup>
      {estado.error ? (
        <p role="alert" className="rounded-[10px] bg-frenada px-3 py-2 text-sm text-frenada-foreground">
          {estado.error}
        </p>
      ) : null}
      <Button type="submit" className="h-11" disabled={pendiente}>
        {pendiente ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        {pendiente ? "Creando tu cuenta…" : "Crear mi cuenta"}
      </Button>
    </form>
  );
}
