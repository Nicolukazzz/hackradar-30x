"use client";

import { ArrowLeftIcon, ArrowRightIcon, EyeIcon, EyeOffIcon, Loader2Icon, MailIcon } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { avanzar } from "@/app/entrar/acciones";
import { MINIMO_CONTRASENA, type EstadoEntrar, type Vista } from "@/app/entrar/estado";
import { CampoCodigo } from "@/components/campo-codigo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// /entrar (#49, #81): iniciar sesión y, si se olvidó, cambiar la contraseña con un código. No hay «Crear cuenta»:
// las cuentas las crea el admin (#80). Un solo estado; volver atrás es local ("ir"), el resto lo resuelve la acción.

async function despachar(previo: EstadoEntrar, formulario: FormData): Promise<EstadoEntrar> {
  if (formulario.get("accion") === "ir") return { vista: formulario.get("vista") as Vista, correo: previo.correo };
  return avanzar(previo, formulario);
}

export function FormularioEntrar({ siguiente }: { siguiente: string }) {
  const [estado, accion] = useActionState(despachar, { vista: "entrar" });

  function ir(vista: Vista) {
    const formulario = new FormData();
    formulario.set("accion", "ir");
    formulario.set("vista", vista);
    startTransition(() => accion(formulario));
  }

  const comun = { estado, accion, siguiente, ir };
  return (
    <div className="w-full max-w-sm">
      <Card className="rounded-2xl shadow-sm">
        {estado.vista === "entrar" ? (
          <PasoEntrar {...comun} />
        ) : estado.vista === "olvide" ? (
          <PasoOlvide {...comun} />
        ) : (
          <PasoRecuperar {...comun} correo={estado.correo ?? ""} />
        )}
      </Card>
    </div>
  );
}

type PropsPaso = {
  estado: EstadoEntrar;
  accion: (formulario: FormData) => void;
  siguiente: string;
  ir: (vista: Vista) => void;
};

function PasoEntrar({ estado, accion, siguiente, ir }: PropsPaso) {
  return (
    <>
      <CardHeader className="gap-1">
        <CardTitle className="text-xl">Bienvenido de nuevo</CardTitle>
        <CardDescription>Entra con el correo y la contraseña de tu cuenta. Si aún no tienes una, pídela a tu administrador.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={accion}>
          <input type="hidden" name="accion" value="iniciar" />
          <input type="hidden" name="siguiente" value={siguiente} />
          <FieldGroup>
            <CampoCorreo autoFocus invalido={Boolean(estado.error)} valor={estado.correo} />
            <CampoContrasena nueva={false} etiqueta="Contraseña" />
            {estado.error && <FieldError>{estado.error}</FieldError>}
            <BotonEnviar etiqueta="Iniciar sesión" pendiente="Entrando…" />
            <Button type="button" variant="ghost" className="h-11" onClick={() => ir("olvide")}>
              ¿Olvidaste tu contraseña?
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </>
  );
}

function PasoOlvide({ estado, accion, ir }: PropsPaso) {
  return (
    <>
      <CabeceraPaso
        paso="Paso 1 de 2"
        titulo="Cambia tu contraseña"
        descripcion="Escribe tu correo y te enviamos un código para elegir una contraseña nueva."
      />
      <CardContent>
        <form action={accion}>
          <input type="hidden" name="accion" value="olvide" />
          <FieldGroup>
            <CampoCorreo autoFocus invalido={Boolean(estado.error)} valor={estado.correo} />
            {estado.error && <FieldError>{estado.error}</FieldError>}
            <BotonEnviar etiqueta="Enviar código" pendiente="Enviando…" />
            <Volver onClick={() => ir("entrar")} />
          </FieldGroup>
        </form>
      </CardContent>
    </>
  );
}

function PasoRecuperar({ estado, accion, siguiente, ir, correo }: PropsPaso & { correo: string }) {
  return (
    <>
      <CabeceraPaso
        paso="Paso 2 de 2"
        titulo="Elige tu contraseña nueva"
        descripcion={
          <>
            Si <span className="font-medium text-foreground">{correo}</span> tiene cuenta, le enviamos un código de 6 dígitos. Vence en
            10 minutos.
          </>
        }
      />
      <CardContent>
        <form action={accion}>
          <input type="hidden" name="accion" value="recuperar" />
          <input type="hidden" name="correo" value={correo} />
          <input type="hidden" name="siguiente" value={siguiente} />
          <FieldGroup>
            <CampoCodigo />
            <CampoContrasena nueva etiqueta="Contraseña nueva" ayuda={`Al menos ${MINIMO_CONTRASENA} caracteres.`} />
            {estado.error && <FieldError>{estado.error}</FieldError>}
            <BotonEnviar etiqueta="Guardar y entrar" pendiente="Guardando…" />
            <Volver onClick={() => ir("olvide")} />
          </FieldGroup>
        </form>
      </CardContent>
    </>
  );
}

function CabeceraPaso({ paso, titulo, descripcion }: { paso: string; titulo: string; descripcion: React.ReactNode }) {
  return (
    <CardHeader>
      <span className="text-xs font-medium text-muted-foreground">{paso}</span>
      <CardTitle className="text-xl">{titulo}</CardTitle>
      <CardDescription className="flex items-start gap-2">
        <MailIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{descripcion}</span>
      </CardDescription>
    </CardHeader>
  );
}

function CampoCorreo({ autoFocus, invalido, valor }: { autoFocus: boolean; invalido: boolean; valor: string | undefined }) {
  return (
    <Field data-invalid={invalido}>
      <FieldLabel htmlFor="correo">Correo</FieldLabel>
      <Input
        id="correo"
        name="correo"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="nombre@empresa.com"
        required
        autoFocus={autoFocus}
        defaultValue={valor}
        aria-invalid={invalido}
        className="h-11"
      />
    </Field>
  );
}

function CampoContrasena({ nueva, etiqueta, ayuda }: { nueva: boolean; etiqueta: string; ayuda?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field>
      <FieldLabel htmlFor="contrasena">{etiqueta}</FieldLabel>
      <div className="relative">
        <Input
          id="contrasena"
          name="contrasena"
          type={visible ? "text" : "password"}
          autoComplete={nueva ? "new-password" : "current-password"}
          minLength={nueva ? MINIMO_CONTRASENA : undefined}
          maxLength={72}
          required
          className="h-11 pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {visible ? <EyeOffIcon aria-hidden className="size-4" /> : <EyeIcon aria-hidden className="size-4" />}
        </button>
      </div>
      {ayuda && <FieldDescription>{ayuda}</FieldDescription>}
    </Field>
  );
}

function BotonEnviar({ etiqueta, pendiente }: { etiqueta: string; pendiente: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 bg-brand text-brand-foreground hover:bg-brand/85" disabled={pending}>
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

function Volver({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" className="h-11" onClick={onClick}>
      <ArrowLeftIcon data-icon="inline-start" />
      Volver
    </Button>
  );
}
