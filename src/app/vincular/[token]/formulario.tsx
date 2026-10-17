"use client";

import { CheckCircle2Icon, Loader2Icon, MailIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { Boton } from "@/app/_componentes";
import { BotonCopiar } from "@/app/_componentes/invitacion";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { VistaEnlace, Vinculado } from "@/vinculos/servicio";

// Dos pasos: escribir el correo → listo (id de conexión y a dónde mandar las facturas). Nada de reglas ni montos.

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function FormularioVincular({ token, vista, buzon }: { token: string; vista: VistaEnlace; buzon: string | null }) {
  const [correo, setCorreo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<Vinculado | null>(null);
  const [ocupado, iniciar] = useTransition();
  const limpio = correo.trim().toLowerCase();
  const invalido = correo.trim() !== "" && !CORREO.test(limpio);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!limpio || invalido) return;
    setError(null);
    iniciar(async () => {
      try {
        const res = await fetch(`/api/vincular/${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ correo: limpio }),
        });
        const datos = (await res.json().catch(() => ({}))) as Vinculado & { error?: string };
        if (!res.ok) return setError(datos.error ?? "No se pudo vincular. Intenta de nuevo.");
        setListo(datos);
      } catch {
        setError("No hay conexión. Revisa tu internet e intenta de nuevo.");
      }
    });
  }

  if (listo) {
    return (
      <section className="flex w-full max-w-md flex-col gap-6 rounded-2xl border bg-card p-6 shadow-xs sm:p-8" aria-live="polite">
        <div className="flex flex-col gap-2">
          <CheckCircle2Icon className="size-7 text-pagada-punto" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Correo vinculado</h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {listo.existente
              ? `Las facturas de ${listo.nombre} que envíes desde ${listo.correo} llegarán directo a ${vista.empresa}.`
              : `Registramos ${listo.correo} para ${listo.nombre}. La primera factura la revisa una persona del equipo de ${vista.empresa}.`}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl bg-superficie-2 p-4 ring-1 ring-border">
          <span className="text-[13px] text-muted-foreground">Tu id de conexión</span>
          <span className="font-mono text-xl font-semibold tracking-wider tabular-nums">{listo.conexion_id}</span>
          <span className="text-[13px] text-muted-foreground">Guárdalo: identifica tu conexión con {vista.empresa} si necesitas ayuda.</span>
        </div>
        <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <MailIcon className="mt-0.5 size-4 flex-none" aria-hidden />
          <span>
            {buzon ? (
              <>
                Envía tus facturas (PDF o foto) desde <strong className="font-medium text-foreground">{listo.correo}</strong> a{" "}
                <strong className="font-medium text-foreground">{buzon}</strong>.
              </>
            ) : (
              <>
                Envía tus facturas (PDF o foto) desde <strong className="font-medium text-foreground">{listo.correo}</strong> al correo de cuentas por pagar de{" "}
                {vista.empresa}.
              </>
            )}
          </span>
        </p>
        <BotonCopiar enlace={listo.conexion_id} texto="Copiar id de conexión" descripcion="Guárdalo junto a tus datos de facturación." />
      </section>
    );
  }

  return (
    <form onSubmit={enviar} className="flex w-full max-w-md flex-col gap-6 rounded-2xl border bg-card p-6 shadow-xs sm:p-8" noValidate>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] text-muted-foreground">{vista.empresa}</span>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Vincula tu correo de facturación</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {vista.existente
            ? `Escribe el correo desde el que ${vista.nombre} envía sus facturas a ${vista.empresa}.`
            : `${vista.empresa} te invitó a enviarle facturas como ${vista.nombre}. Escribe el correo desde el que las vas a enviar.`}
        </p>
      </div>
      <Field data-invalid={invalido || error !== null || undefined}>
        <FieldLabel htmlFor="correo-facturacion">Correo de facturación</FieldLabel>
        <Input
          id="correo-facturacion"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="facturacion@tuempresa.com"
          value={correo}
          onChange={(e) => {
            setCorreo(e.target.value);
            setError(null);
          }}
          aria-invalid={invalido || error !== null || undefined}
          className="h-11"
        />
        {invalido ? (
          <FieldError>Escribe un correo válido.</FieldError>
        ) : error ? (
          <FieldError>{error}</FieldError>
        ) : (
          <FieldDescription>Solo las facturas que lleguen desde este correo quedarán a tu nombre. El enlace sirve una sola vez.</FieldDescription>
        )}
      </Field>
      <Boton variante="primaria" type="submit" disabled={!limpio || invalido || ocupado}>
        {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        {ocupado ? "Vinculando…" : "Vincular correo"}
      </Boton>
    </form>
  );
}
