"use client";

import { LinkIcon, Loader2Icon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Boton } from "@/app/_componentes";
import { BotonCopiar, EnlaceGenerado } from "@/app/_componentes/invitacion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NOMBRE_ROL, type Rol } from "@/lib/auth/permisos";

import { useMonedaBase } from "@/app/_componentes/moneda-base";
import { llamar, usdACentavos } from "./api";
import { ElegirRol } from "./elegir-rol";

// "Crear empleado" (#80), en 3 pasos: rol → correo (y límite si aprueba) → confirmar. Al confirmar se crea un enlace de un
// solo uso, atado a ese correo, que vence en 72 horas; ahí la persona elige su nombre y su contraseña. No se envía correo:
// el admin copia el enlace y se lo pasa por un medio seguro. Es la única vez que el enlace existe en claro.

type Paso = "rol" | "correo" | "confirmar" | "listo";
type Creado = { enlace: string; invitacion: { expira_en: string } };

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function vence(iso: string): string {
  const f = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "long", timeStyle: "short" }).format(new Date(iso));
  return `${f} (hora de Bogotá)`;
}

export function CrearEmpleado() {
  const moneda = useMonedaBase();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<Paso>("rol");
  const [rol, setRol] = useState<Rol>("aprobador");
  const [limite, setLimite] = useState("");
  const [correo, setCorreo] = useState("");
  const [creado, setCreado] = useState<Creado | null>(null);
  const [ocupado, iniciar] = useTransition();

  const centavos = rol === "aprobador" ? usdACentavos(limite) : null;
  const limiteInvalido = Number.isNaN(centavos) || centavos === 0;
  const correoLimpio = correo.trim().toLowerCase();
  const correoInvalido = correo.trim() !== "" && !CORREO.test(correoLimpio);

  function reiniciar() {
    setPaso("rol");
    setRol("aprobador");
    setLimite("");
    setCorreo("");
    setCreado(null);
  }

  function cambiarAbierto(a: boolean) {
    setAbierto(a);
    if (!a) {
      if (creado) router.refresh();
      reiniciar();
    }
  }

  function crear() {
    iniciar(async () => {
      try {
        const r = await llamar<Creado>("/api/equipo/invitaciones", "POST", { rol, limite_aprobacion_usd: centavos, correo_esperado: correoLimpio });
        setCreado(r);
        setPaso("listo");
      } catch (e) {
        toast.error("No se creó el empleado", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  const numero = { rol: 1, correo: 2, confirmar: 3, listo: 3 }[paso];
  const titulo = { rol: "¿Qué podrá hacer?", correo: "¿A qué correo le llega?", confirmar: "Revisa y crea el enlace", listo: "Enlace listo" }[paso];
  const descripcion = {
    rol: "Elige el rol. Puedes cambiarlo después desde esta pantalla.",
    correo: "Crearás un enlace para que elija su nombre y su contraseña. Solo esta dirección podrá usarlo.",
    confirmar: "El enlace sirve una sola vez y vence en 72 horas.",
    listo: `Cópialo y envíaselo a ${correoLimpio} por un medio seguro. Por seguridad no se vuelve a mostrar; cuando cree su contraseña aparecerá en Miembros.`,
  }[paso];

  return (
    <>
      <Boton variante="primaria" onClick={() => setAbierto(true)}>
        <UserPlusIcon aria-hidden />
        Crear empleado
      </Boton>
      <Dialog open={abierto} onOpenChange={cambiarAbierto}>
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader>
            {paso !== "listo" ? <span className="text-xs text-muted-foreground">Paso {numero} de 3</span> : null}
            <DialogTitle className="text-lg">{titulo}</DialogTitle>
            <DialogDescription>{descripcion}</DialogDescription>
          </DialogHeader>

          {paso === "rol" ? <ElegirRol valor={rol} onCambio={setRol} nombre="rol-empleado" /> : null}

          {paso === "correo" ? (
            <FieldGroup className="gap-4">
              <Field data-invalid={correoInvalido || undefined}>
                <FieldLabel htmlFor="correo-empleado">Correo del empleado</FieldLabel>
                <Input
                  id="correo-empleado"
                  type="email"
                  autoComplete="off"
                  autoFocus
                  placeholder="nombre@empresa.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  aria-invalid={correoInvalido || undefined}
                  className="h-11"
                />
                {correoInvalido ? <FieldError>Escribe un correo válido.</FieldError> : <FieldDescription>Solo esta dirección podrá crear la cuenta con el enlace.</FieldDescription>}
              </Field>
              {rol === "aprobador" ? (
                <Field data-invalid={limiteInvalido || undefined}>
                  <FieldLabel htmlFor="limite">Límite por pago ({moneda})</FieldLabel>
                  <Input
                    id="limite"
                    inputMode="decimal"
                    placeholder="Sin límite"
                    value={limite}
                    onChange={(e) => setLimite(e.target.value)}
                    aria-invalid={limiteInvalido || undefined}
                    className="h-11 font-mono tabular-nums"
                  />
                  {limiteInvalido ? <FieldError>Escribe un monto como 5.000 o déjalo vacío.</FieldError> : <FieldDescription>Vacío = puede aprobar cualquier monto.</FieldDescription>}
                </Field>
              ) : null}
            </FieldGroup>
          ) : null}

          {paso === "confirmar" ? (
            <dl className="flex flex-col gap-2.5 rounded-xl bg-superficie-2 p-4 text-sm ring-1 ring-border">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Correo</dt>
                <dd className="font-medium break-all">{correoLimpio}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Rol</dt>
                <dd className="font-medium">{NOMBRE_ROL[rol]}</dd>
              </div>
              {rol === "aprobador" ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Límite por pago</dt>
                  <dd className="font-mono font-medium tabular-nums">{centavos === null ? "Sin límite" : `${moneda} ${limite}`}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">El enlace vence</dt>
                <dd className="font-medium">en 72 horas</dd>
              </div>
            </dl>
          ) : null}

          {paso === "listo" && creado ? (
            <EnlaceGenerado enlace={creado.enlace} etiqueta="Enlace para crear la cuenta" resumen={`${NOMBRE_ROL[rol]} · solo ${correoLimpio} · vence el ${vence(creado.invitacion.expira_en)}`} />
          ) : null}

          <DialogFooter className="-mx-6 -mb-6 px-6">
            {paso === "rol" ? (
              <Boton variante="primaria" onClick={() => setPaso("correo")}>
                Continuar
              </Boton>
            ) : null}
            {paso === "correo" ? (
              <>
                <Boton variante="secundaria" onClick={() => setPaso("rol")}>
                  Atrás
                </Boton>
                <Boton variante="primaria" onClick={() => setPaso("confirmar")} disabled={!correoLimpio || correoInvalido || limiteInvalido}>
                  Continuar
                </Boton>
              </>
            ) : null}
            {paso === "confirmar" ? (
              <>
                <Boton variante="secundaria" onClick={() => setPaso("correo")} disabled={ocupado}>
                  Atrás
                </Boton>
                <Boton variante="primaria" onClick={crear} disabled={ocupado}>
                  {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : <LinkIcon aria-hidden />}
                  {ocupado ? "Creando…" : "Crear enlace"}
                </Boton>
              </>
            ) : null}
            {paso === "listo" ? (
              <>
                {creado ? <BotonCopiar enlace={creado.enlace} descripcion="Envíaselo a la persona por un medio seguro." /> : null}
                <Boton variante="secundaria" onClick={() => cambiarAbierto(false)}>
                  Listo
                </Boton>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
