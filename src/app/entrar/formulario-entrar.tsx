"use client";

import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon, MailIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { pedirCodigo, verificarCodigo } from "@/app/entrar/acciones";
import { AVISO_CODIGO_ENVIADO, type EstadoEntrar } from "@/app/entrar/estado";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";

export function FormularioEntrar({ siguiente }: { siguiente: string }) {
  // Cambiar la clave reinicia el asistente ("Usar otro correo").
  const [intento, setIntento] = useState(0);

  return (
    <div className="w-full max-w-sm">
      <AsistenteCodigo key={intento} siguiente={siguiente} reiniciar={() => setIntento((n) => n + 1)} />
    </div>
  );
}

function AsistenteCodigo({ siguiente, reiniciar }: { siguiente: string; reiniciar: () => void }) {
  const [estadoCorreo, accionCorreo] = useActionState<EstadoEntrar, FormData>(pedirCodigo, { paso: "correo" });

  return (
    <Card className="rounded-2xl shadow-sm">
      {estadoCorreo.paso === "correo" ? (
        <>
          <CardHeader>
            <span className="text-xs font-medium text-muted-foreground">Paso 1 de 2</span>
            <CardTitle className="text-xl">Tu correo de trabajo</CardTitle>
            <CardDescription>Solo entran personas que la empresa ya registró.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={accionCorreo}>
              <FieldGroup>
                <Field data-invalid={Boolean(estadoCorreo.error)}>
                  <FieldLabel htmlFor="correo">Correo</FieldLabel>
                  <Input
                    id="correo"
                    name="correo"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="nombre@empresa.com"
                    required
                    autoFocus
                    aria-invalid={Boolean(estadoCorreo.error)}
                    className="h-11"
                  />
                  {estadoCorreo.error && <FieldError>{estadoCorreo.error}</FieldError>}
                </Field>
                <BotonEnviar etiqueta="Enviar código" pendiente="Enviando…" />
              </FieldGroup>
            </form>
          </CardContent>
        </>
      ) : (
        <PasoCodigo correo={estadoCorreo.correo} siguiente={siguiente} reiniciar={reiniciar} />
      )}
    </Card>
  );
}

function PasoCodigo({ correo, siguiente, reiniciar }: { correo: string; siguiente: string; reiniciar: () => void }) {
  const [estado, accion] = useActionState<EstadoEntrar, FormData>(verificarCodigo, { paso: "codigo", correo });
  const [codigo, setCodigo] = useState("");
  const error = estado.error;

  return (
    <>
      <CardHeader>
        <span className="text-xs font-medium text-muted-foreground">Paso 2 de 2</span>
        <CardTitle className="text-xl">Escribe el código</CardTitle>
        <CardDescription className="flex items-start gap-2">
          <MailIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            {AVISO_CODIGO_ENVIADO} Revisa <span className="font-medium text-foreground">{correo}</span>. Vence en 10 minutos.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={accion}>
          <input type="hidden" name="correo" value={correo} />
          <input type="hidden" name="siguiente" value={siguiente} />
          <FieldGroup>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="codigo">Código de 6 dígitos</FieldLabel>
              <InputOTP
                id="codigo"
                name="codigo"
                maxLength={6}
                value={codigo}
                onChange={setCodigo}
                inputMode="numeric"
                pattern="^\d+$"
                autoComplete="one-time-code"
                autoFocus
                aria-invalid={Boolean(error)}
                containerClassName="font-mono tabular-nums"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="size-11" />
                  <InputOTPSlot index={1} className="size-11" />
                  <InputOTPSlot index={2} className="size-11" />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} className="size-11" />
                  <InputOTPSlot index={4} className="size-11" />
                  <InputOTPSlot index={5} className="size-11" />
                </InputOTPGroup>
              </InputOTP>
              {error ? <FieldError>{error}</FieldError> : <FieldDescription>Puedes pegarlo desde el correo.</FieldDescription>}
            </Field>
            <BotonEnviar etiqueta="Entrar" pendiente="Verificando…" deshabilitado={codigo.length !== 6} />
            <Button type="button" variant="ghost" className="h-11" onClick={reiniciar}>
              <ArrowLeftIcon data-icon="inline-start" />
              Usar otro correo
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </>
  );
}

function BotonEnviar({ etiqueta, pendiente, deshabilitado = false }: { etiqueta: string; pendiente: string; deshabilitado?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 bg-brand text-brand-foreground hover:bg-brand/85" disabled={pending || deshabilitado}>
      {pending ? (
        <>
          <Loader2Icon data-icon="inline-start" className="animate-spin" />
          {pendiente}
        </>
      ) : (
        <>
          {etiqueta}
          <ArrowRightIcon data-icon="inline-end" />
        </>
      )}
    </Button>
  );
}
