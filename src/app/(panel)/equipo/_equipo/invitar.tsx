"use client";

import { Loader2Icon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Boton } from "@/app/_componentes";
import { BotonCopiar, EnlaceGenerado, SelectorOpciones, VIGENCIAS } from "@/app/_componentes/invitacion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NOMBRE_ROL, type Rol } from "@/lib/auth/permisos";

import { llamar, usdACentavos } from "./api";
import { ElegirRol } from "./elegir-rol";

// "Invitar persona" (#51), en 3 pasos: rol → detalles (máx. 3 campos) → enlace para copiar. El enlace lleva el
// token en claro y solo existe en esta respuesta: se avisa que se copie ahora.

type Paso = "rol" | "detalles" | "enlace";

export function Invitar() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<Paso>("rol");
  const [rol, setRol] = useState<Rol>("aprobador");
  const [limite, setLimite] = useState("");
  const [correo, setCorreo] = useState("");
  const [dias, setDias] = useState("7");
  const [enlace, setEnlace] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const centavos = rol === "aprobador" ? usdACentavos(limite) : null;
  const limiteInvalido = Number.isNaN(centavos) || centavos === 0;

  function reiniciar() {
    setPaso("rol");
    setRol("aprobador");
    setLimite("");
    setCorreo("");
    setDias("7");
    setEnlace(null);
  }

  function cambiarAbierto(a: boolean) {
    setAbierto(a);
    if (!a) {
      if (enlace) router.refresh();
      reiniciar();
    }
  }

  function crear() {
    iniciar(async () => {
      try {
        const r = await llamar<{ enlace: string }>("/api/equipo/invitaciones", "POST", {
          rol,
          limite_aprobacion_usd: centavos,
          correo_esperado: correo.trim() || null,
          dias_vigencia: Number(dias),
        });
        setEnlace(r.enlace);
        setPaso("enlace");
      } catch (e) {
        toast.error("No se creó la invitación", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  return (
    <>
      <Boton variante="primaria" onClick={() => setAbierto(true)}>
        <UserPlusIcon aria-hidden />
        Invitar persona
      </Boton>
      <Dialog open={abierto} onOpenChange={cambiarAbierto}>
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader>
            <span className="text-xs text-muted-foreground">Paso {paso === "rol" ? 1 : paso === "detalles" ? 2 : 3} de 3</span>
            <DialogTitle className="text-lg">
              {paso === "rol" ? "¿Qué podrá hacer?" : paso === "detalles" ? `Invitar como ${NOMBRE_ROL[rol]}` : "Enlace listo"}
            </DialogTitle>
            <DialogDescription>
              {paso === "rol"
                ? "Elige el rol. Puedes cambiarlo después desde esta pantalla."
                : paso === "detalles"
                  ? "El enlace sirve una sola vez y vence solo."
                  : "Cópialo ahora: por seguridad no se vuelve a mostrar. Quien lo abra entra con su cuenta y queda en el equipo."}
            </DialogDescription>
          </DialogHeader>

          {paso === "rol" ? <ElegirRol valor={rol} onCambio={setRol} nombre="rol-invitacion" /> : null}

          {paso === "detalles" ? (
            <FieldGroup className="gap-4">
              {rol === "aprobador" ? (
                <Field data-invalid={limiteInvalido || undefined}>
                  <FieldLabel htmlFor="limite">Límite por pago (USD)</FieldLabel>
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
              <Field>
                <FieldLabel htmlFor="correo">Correo de la persona (opcional)</FieldLabel>
                <Input id="correo" type="email" autoComplete="off" placeholder="nombre@empresa.com" value={correo} onChange={(e) => setCorreo(e.target.value)} className="h-11" />
                <FieldDescription>Si lo escribes, solo una cuenta con ese correo podrá usar el enlace.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="vigencia">Vence en</FieldLabel>
                <SelectorOpciones id="vigencia" opciones={VIGENCIAS} valor={dias} onCambio={setDias} />
              </Field>
            </FieldGroup>
          ) : null}

          {paso === "enlace" && enlace ? (
            <EnlaceGenerado
              enlace={enlace}
              etiqueta="Enlace de invitación"
              resumen={
                <>
                  {NOMBRE_ROL[rol]}
                  {rol === "aprobador" ? (centavos === null ? " · sin límite" : ` · hasta USD ${limite}`) : ""} · vence en {VIGENCIAS.find((v) => v.value === dias)?.label}
                  {correo.trim() ? ` · solo ${correo.trim().toLowerCase()}` : ""}
                </>
              }
            />
          ) : null}

          <DialogFooter className="-mx-6 -mb-6 px-6">
            {paso === "rol" ? (
              <Boton variante="primaria" onClick={() => setPaso("detalles")}>
                Continuar
              </Boton>
            ) : null}
            {paso === "detalles" ? (
              <>
                <Boton variante="secundaria" onClick={() => setPaso("rol")} disabled={ocupado}>
                  Atrás
                </Boton>
                <Boton variante="primaria" onClick={crear} disabled={ocupado || limiteInvalido}>
                  {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
                  {ocupado ? "Creando…" : "Crear enlace"}
                </Boton>
              </>
            ) : null}
            {paso === "enlace" ? (
              <>
                <Boton variante="secundaria" onClick={() => cambiarAbierto(false)}>
                  Listo
                </Boton>
                <BotonCopiar enlace={enlace ?? ""} descripcion="Envíaselo a la persona por el medio que prefieras." />
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
