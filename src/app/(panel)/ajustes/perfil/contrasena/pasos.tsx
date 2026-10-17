"use client";

import { CheckCircle2Icon, EyeIcon, EyeOffIcon, Loader2Icon, MailIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";

import { Boton, Tarjeta } from "@/app/_componentes";
import { MINIMO_CONTRASENA } from "@/app/entrar/estado";
import { CampoCodigo } from "@/components/campo-codigo";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { cambiarContrasena, enviarCodigoSeguridad, type EstadoCambio } from "./acciones";

// Cambiar la contraseña (#82), un paso por pantalla: enviar código → código + contraseña nueva → listo.

export function PasosContrasena({ correo }: { correo: string }) {
  const [enviado, setEnviado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const [estado, accion, guardando] = useActionState<EstadoCambio, FormData>(cambiarContrasena, {});
  const [visible, setVisible] = useState(false);
  // Controlada: React 19 vacía el formulario tras cada envío y obligaría a reescribirla en cada error.
  const [contrasena, setContrasena] = useState("");
  // Si el código ya se gastó (la contraseña no se guardó después de verificarlo), se vuelve al paso 1 a pedir otro.
  // Al pedirlo, ese resultado queda atendido.
  const [atendido, setAtendido] = useState<EstadoCambio | null>(null);
  const codigoGastado = Boolean(estado.codigo_usado) && estado !== atendido;
  const errorPrevio = codigoGastado ? `${estado.error ?? ""} Pide un código nuevo para intentarlo otra vez.`.trim() : null;

  function enviar() {
    setErrorEnvio(null);
    setAtendido(estado);
    iniciar(async () => {
      const r = await enviarCodigoSeguridad();
      if (r.ok) {
        setEnviado(true);
        toast.success("Código enviado", { description: `Revisa ${correo}.` });
      } else setErrorEnvio(r.error);
    });
  }

  const paso = estado.listo ? 3 : enviado && !codigoGastado ? 2 : 1;
  const avisoEnvio = errorEnvio ?? errorPrevio;
  const alerta = avisoEnvio ? (
    <p role="alert" className="rounded-[10px] bg-frenada px-3 py-2 text-sm text-frenada-foreground">
      {avisoEnvio}
    </p>
  ) : null;
  return (
    <Tarjeta className="max-w-[480px] gap-5 p-6">
      <div className="flex flex-col gap-1">
        {paso < 3 ? <span className="text-xs text-muted-foreground">Paso {paso} de 2</span> : null}
        <h2 className="text-lg font-semibold tracking-tight">{paso === 1 ? "Confirma que eres tú" : paso === 2 ? "Elige tu contraseña nueva" : "Contraseña cambiada"}</h2>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          {paso === 1 ? (
            <>
              <MailIcon aria-hidden className="mt-0.5 size-4 flex-none" />
              <span>
                Te enviaremos un código de 6 dígitos a <strong className="font-medium text-foreground">{correo}</strong>. Vence en 10 minutos.
              </span>
            </>
          ) : paso === 2 ? (
            <span>Escribe el código que llegó a {correo} y tu contraseña nueva.</span>
          ) : (
            <span>La próxima vez que entres, usa la contraseña nueva.</span>
          )}
        </p>
      </div>

      {paso === 1 ? (
        <div className="flex flex-col gap-3">
          {alerta}
          <Boton variante="primaria" onClick={enviar} disabled={enviando}>
            {enviando ? <Loader2Icon className="animate-spin" aria-hidden /> : <MailIcon aria-hidden />}
            {enviando ? "Enviando…" : "Enviar código"}
          </Boton>
        </div>
      ) : null}

      {paso === 2 ? (
        <form action={accion}>
          <FieldGroup className="gap-4">
            <CampoCodigo />
            <Field>
              <FieldLabel htmlFor="contrasena">Contraseña nueva</FieldLabel>
              <div className="relative">
                <Input
                  id="contrasena"
                  name="contrasena"
                  type={visible ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={MINIMO_CONTRASENA}
                  maxLength={72}
                  required
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  className="h-11 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={visible}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {visible ? <EyeOffIcon aria-hidden className="size-4" /> : <EyeIcon aria-hidden className="size-4" />}
                </button>
              </div>
              <FieldDescription>Al menos {MINIMO_CONTRASENA} caracteres.</FieldDescription>
            </Field>
            {estado.error && !estado.codigo_usado ? <FieldError>{estado.error}</FieldError> : null}
            {errorEnvio ? alerta : null}
            <Boton type="submit" variante="primaria" disabled={guardando}>
              {guardando ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
              {guardando ? "Guardando…" : "Guardar contraseña"}
            </Boton>
            <Boton type="button" variante="fantasma" onClick={enviar} disabled={enviando}>
              Enviar otro código
            </Boton>
          </FieldGroup>
        </form>
      ) : null}

      {paso === 3 ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 rounded-xl bg-pagada px-4 py-3 text-sm text-pagada-foreground">
            <CheckCircle2Icon aria-hidden className="size-4" />
            Tu contraseña se cambió.
          </p>
          <Boton variante="secundaria" nativeButton={false} render={<Link href="/ajustes" />}>
            Volver a Ajustes
          </Boton>
        </div>
      ) : null}
    </Tarjeta>
  );
}
