"use client";

import { ArrowLeftIcon, ArrowRightIcon, EyeIcon, EyeOffIcon, Loader2Icon, MailIcon } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { avanzar } from "@/app/entrar/acciones";
import { MINIMO_CONTRASENA, type EstadoEntrar, type Vista } from "@/app/entrar/estado";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// /entrar (#49): Iniciar sesión | Crear cuenta, y los pasos con código (confirmar correo, cambiar contraseña).
// Un solo estado; cambiar de pestaña o volver atrás es local ("ir"), el resto lo resuelve la server action.

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
        {estado.vista === "entrar" || estado.vista === "crear" ? (
          <PestanasCuenta {...comun} />
        ) : estado.vista === "confirmar" ? (
          <PasoConfirmar {...comun} correo={estado.correo ?? ""} />
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

function PestanasCuenta({ estado, accion, siguiente, ir }: PropsPaso) {
  const vista = estado.vista;
  return (
    <>
      <CardHeader className="gap-4">
        <Tabs value={vista} onValueChange={(v) => ir(v as Vista)}>
          <TabsList className="h-11 w-full">
            <TabsTrigger value="entrar" className="h-full">
              Iniciar sesión
            </TabsTrigger>
            <TabsTrigger value="crear" className="h-full">
              Crear cuenta
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-xl">{vista === "entrar" ? "Bienvenido de nuevo" : "Crea tu cuenta"}</CardTitle>
          <CardDescription>
            {vista === "entrar"
              ? "Entra con el correo y la contraseña de tu cuenta."
              : "Te enviaremos un código de 6 dígitos para confirmar tu correo."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {/* key: al cambiar de pestaña los campos empiezan vacíos. */}
        <form key={vista} action={accion}>
          <input type="hidden" name="accion" value={vista === "entrar" ? "iniciar" : "crear"} />
          <input type="hidden" name="siguiente" value={siguiente} />
          <FieldGroup>
            {vista === "crear" && (
              <Field>
                <FieldLabel htmlFor="nombre">Tu nombre</FieldLabel>
                <Input
                  id="nombre"
                  name="nombre"
                  autoComplete="name"
                  maxLength={120}
                  required
                  autoFocus
                  defaultValue={estado.nombre}
                  className="h-11"
                />
              </Field>
            )}
            <CampoCorreo autoFocus={vista === "entrar"} invalido={Boolean(estado.error)} valor={estado.correo} />
            <CampoContrasena
              nueva={vista === "crear"}
              etiqueta="Contraseña"
              ayuda={vista === "crear" ? `Al menos ${MINIMO_CONTRASENA} caracteres.` : undefined}
            />
            {estado.error && <FieldError>{estado.error}</FieldError>}
            <BotonEnviar
              etiqueta={vista === "entrar" ? "Iniciar sesión" : "Crear cuenta"}
              pendiente={vista === "entrar" ? "Entrando…" : "Creando…"}
            />
            {vista === "entrar" && (
              <Button type="button" variant="ghost" className="h-11" onClick={() => ir("olvide")}>
                ¿Olvidaste tu contraseña?
              </Button>
            )}
          </FieldGroup>
        </form>
      </CardContent>
    </>
  );
}

function PasoConfirmar({ estado, accion, siguiente, ir, correo }: PropsPaso & { correo: string }) {
  return (
    <>
      <CabeceraPaso
        paso="Último paso"
        titulo="Confirma tu correo"
        descripcion={
          <>
            Escribe el código de 6 dígitos que enviamos a <span className="font-medium text-foreground">{correo}</span>. Vence en 10
            minutos. Si ya tenías cuenta con este correo, inicia sesión.
          </>
        }
      />
      <CardContent>
        <form action={accion}>
          <input type="hidden" name="accion" value="confirmar" />
          <input type="hidden" name="correo" value={correo} />
          <input type="hidden" name="siguiente" value={siguiente} />
          <FieldGroup>
            <CampoCodigo error={estado.error} aviso={estado.aviso} />
            <BotonEnviar etiqueta="Confirmar y entrar" pendiente="Confirmando…" />
          </FieldGroup>
        </form>
        <div className="mt-3 flex flex-col gap-1">
          <form action={accion}>
            <input type="hidden" name="accion" value="reenviar" />
            <input type="hidden" name="correo" value={correo} />
            <BotonSecundario etiqueta="Reenviar código" pendiente="Reenviando…" />
          </form>
          <Volver onClick={() => ir("crear")} />
        </div>
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
            <CampoCodigo error={undefined} aviso={undefined} />
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

function CampoCodigo({ error, aviso }: { error: string | undefined; aviso: string | undefined }) {
  const [codigo, setCodigo] = useState("");
  return (
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
      {error ? <FieldError>{error}</FieldError> : <FieldDescription>{aviso ?? "Puedes pegarlo desde el correo."}</FieldDescription>}
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

function BotonSecundario({ etiqueta, pendiente }: { etiqueta: string; pendiente: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" className="h-11 w-full" disabled={pending}>
      {pending ? pendiente : etiqueta}
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
