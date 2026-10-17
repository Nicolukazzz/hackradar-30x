"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Boton } from "@/app/_componentes";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { normalizarCodigo } from "@/vinculos/codigo";

// Entrar al portal: correo + código, los dos que puso la empresa al crear el enlace.

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function FormularioEntrar({ token, empresa }: { token: string; empresa: string }) {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const correoLimpio = correo.trim().toLowerCase();
  const correoInvalido = correo.trim() !== "" && !CORREO.test(correoLimpio);
  const codigoListo = normalizarCodigo(codigo) !== null;
  const listo = CORREO.test(correoLimpio) && codigoListo;

  function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!listo) return;
    setError(null);
    iniciar(async () => {
      try {
        const res = await fetch(`/api/vincular/${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ correo: correoLimpio, codigo }),
        });
        const datos = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(datos.error ?? "No se pudo entrar. Intenta de nuevo.");
          return;
        }
        router.push(`/vincular/${encodeURIComponent(token)}/facturas`);
      } catch {
        setError("No hay conexión. Revisa tu internet e intenta de nuevo.");
      }
    });
  }

  return (
    <form onSubmit={entrar} className="flex w-full max-w-md flex-col gap-6 rounded-2xl border bg-card p-6 shadow-xs sm:p-8" noValidate>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] text-muted-foreground">{empresa} · Portal de proveedores</span>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Entra para enviar tus facturas</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">Escribe el correo y el código que te pasó {empresa}.</p>
      </div>
      <FieldGroup className="gap-4">
        <Field data-invalid={correoInvalido || undefined}>
          <FieldLabel htmlFor="portal-correo">Correo</FieldLabel>
          <Input
            id="portal-correo"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="facturacion@tuempresa.com"
            value={correo}
            onChange={(e) => {
              setCorreo(e.target.value);
              setError(null);
            }}
            aria-invalid={correoInvalido || undefined}
            className="h-11"
          />
          {correoInvalido ? <FieldError>Escribe un correo válido.</FieldError> : null}
        </Field>
        <Field data-invalid={error !== null || undefined}>
          <FieldLabel htmlFor="portal-codigo">Código</FieldLabel>
          <Input
            id="portal-codigo"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="K7M2-Q9XD"
            maxLength={12}
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value.toUpperCase());
              setError(null);
            }}
            aria-invalid={error !== null || undefined}
            className="h-11 font-mono tracking-widest uppercase tabular-nums"
          />
          {error ? <FieldError>{error}</FieldError> : <FieldDescription>8 caracteres. Los guiones y espacios no importan.</FieldDescription>}
        </Field>
      </FieldGroup>
      <Boton variante="primaria" type="submit" disabled={!listo || ocupado}>
        {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        {ocupado ? "Entrando…" : "Entrar"}
      </Boton>
    </form>
  );
}
