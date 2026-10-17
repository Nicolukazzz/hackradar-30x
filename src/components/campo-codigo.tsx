"use client";

import { useState } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";

// Código de 6 dígitos (#81), centrado. Solo para seguridad: olvidar la contraseña y cambiarla en Ajustes (#82).
// Se envía en el formulario como `codigo`; acepta pegar el código completo desde el correo.

export function CampoCodigo({ error, aviso, autoFocus = true }: { error?: string; aviso?: string; autoFocus?: boolean }) {
  const [codigo, setCodigo] = useState("");
  return (
    <Field data-invalid={Boolean(error)} className="items-center text-center">
      <FieldLabel htmlFor="codigo" className="justify-center">
        Código de 6 dígitos
      </FieldLabel>
      <InputOTP
        id="codigo"
        name="codigo"
        maxLength={6}
        value={codigo}
        onChange={setCodigo}
        inputMode="numeric"
        pattern="^\d+$"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        aria-invalid={Boolean(error)}
        containerClassName="justify-center font-mono tabular-nums"
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
