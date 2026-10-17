"use client";

import { ExternalLinkIcon, LinkIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Boton } from "@/app/_componentes";
import { BotonCopiar, EnlaceGenerado, SelectorOpciones } from "@/app/_componentes/invitacion";
import type { OpcionBeneficiario } from "@/app/_datos/proveedores";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { PermisoUI } from "@/lib/auth/permisos";
import { cn } from "@/lib/utils";

import { llamar } from "../../ajustes/equipo/_equipo/api";

// "Crear enlace" (#85), en 3 pasos: para quién (de la lista o nuevo) → cuál → enlace para copiar. El enlace lleva el
// token en claro y solo existe en esta respuesta. No se envía ningún correo.

type Paso = "tipo" | "quien" | "enlace";
type Tipo = "lista" | "nuevo";

const TIPOS: { valor: Tipo; titulo: string; descripcion: string }[] = [
  { valor: "lista", titulo: "Proveedor de la lista", descripcion: "Ya está entre los permitidos. Su correo queda vinculado y sus facturas siguen las reglas normales." },
  { valor: "nuevo", titulo: "Proveedor nuevo", descripcion: "Todavía no está en la lista. Su correo queda registrado y su primera factura la decide una persona." },
];

export function CrearEnlace({ beneficiarios, permiso }: { beneficiarios: OpcionBeneficiario[]; permiso: PermisoUI }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<Paso>("tipo");
  const [tipo, setTipo] = useState<Tipo>("lista");
  const [beneficiario, setBeneficiario] = useState(beneficiarios[0]?.id ?? "");
  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const nombreLimpio = nombre.trim();
  const elegido = beneficiarios.find((b) => b.id === beneficiario);
  const listoParaCrear = tipo === "lista" ? Boolean(elegido) : nombreLimpio.length >= 2;
  const paraQuien = tipo === "lista" ? (elegido?.nombre ?? "") : nombreLimpio;

  function reiniciar() {
    setPaso("tipo");
    setTipo("lista");
    setBeneficiario(beneficiarios[0]?.id ?? "");
    setNombre("");
    setUrl(null);
  }

  function cambiarAbierto(a: boolean) {
    setAbierto(a);
    if (!a) {
      if (url) router.refresh();
      reiniciar();
    }
  }

  function crear() {
    iniciar(async () => {
      try {
        const r = await llamar<{ url: string }>("/api/proveedores/enlaces", "POST", tipo === "lista" ? { beneficiario_id: beneficiario } : { nombre: nombreLimpio });
        setUrl(r.url);
        setPaso("enlace");
      } catch (e) {
        toast.error("No se creó el enlace", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  const numero = { tipo: 1, quien: 2, enlace: 3 }[paso];
  const titulo = { tipo: "¿Para quién es el enlace?", quien: tipo === "lista" ? "¿Qué proveedor?" : "¿Cómo se llama?", enlace: "Enlace listo" }[paso];
  const descripcion = {
    tipo: "El proveedor abre el enlace, escribe el correo desde el que manda sus facturas y recibe su id de conexión.",
    quien: tipo === "lista" ? "Solo aparecen los proveedores activos de la lista permitida." : "Como aparece en sus facturas. Lo verás en la lista de enlaces y en el registro.",
    enlace: "Cópialo y pásaselo por el medio que ya usan; ábrelo para ver lo que verá el proveedor. Solo se gasta cuando alguien vincula un correo. Por seguridad no se vuelve a mostrar y vence en 7 días.",
  }[paso];

  if (!permiso.ok) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <Boton variante="primaria" disabled>
          <LinkIcon aria-hidden />
          Crear enlace
        </Boton>
        <span className="max-w-[260px] text-right text-[13px] text-muted-foreground">{permiso.motivo}</span>
      </div>
    );
  }

  return (
    <>
      <Boton variante="primaria" onClick={() => setAbierto(true)}>
        <LinkIcon aria-hidden />
        Crear enlace
      </Boton>
      <Dialog open={abierto} onOpenChange={cambiarAbierto}>
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader>
            <span className="text-xs text-muted-foreground">Paso {numero} de 3</span>
            <DialogTitle className="text-lg">{titulo}</DialogTitle>
            <DialogDescription>{descripcion}</DialogDescription>
          </DialogHeader>

          {paso === "tipo" ? (
            <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as Tipo)} name="tipo-proveedor" aria-label="Para quién es el enlace" className="gap-2.5">
              {TIPOS.map((t) => (
                <label
                  key={t.valor}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3.5 transition-colors hover:bg-superficie-2",
                    tipo === t.valor && "border-foreground/40 bg-superficie-2",
                  )}
                >
                  <RadioGroupItem value={t.valor} className="mt-0.5" disabled={t.valor === "lista" && beneficiarios.length === 0} />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">{t.titulo}</span>
                    <span className="text-[13px] leading-snug text-muted-foreground">{t.descripcion}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          ) : null}

          {paso === "quien" ? (
            <FieldGroup className="gap-4">
              {tipo === "lista" ? (
                <Field>
                  <FieldLabel htmlFor="enlace-beneficiario">Proveedor</FieldLabel>
                  <SelectorOpciones id="enlace-beneficiario" opciones={beneficiarios.map((b) => ({ value: b.id, label: b.nombre }))} valor={beneficiario} onCambio={setBeneficiario} />
                  <FieldDescription>
                    {elegido && elegido.correos > 0
                      ? `Ya tiene ${elegido.correos} ${elegido.correos === 1 ? "correo vinculado" : "correos vinculados"}; este se suma.`
                      : "Todavía no tiene correo vinculado."}
                  </FieldDescription>
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="enlace-nombre">Nombre del proveedor</FieldLabel>
                  <Input
                    id="enlace-nombre"
                    autoComplete="off"
                    autoFocus
                    placeholder="Ej.: Estudio Nuevo S.A.S."
                    maxLength={120}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="h-11"
                  />
                </Field>
              )}
            </FieldGroup>
          ) : null}

          {paso === "enlace" && url ? (
            <EnlaceGenerado enlace={url} etiqueta="Enlace para el proveedor" resumen={`${paraQuien} · ${tipo === "lista" ? "de la lista" : "proveedor nuevo"} · un solo uso · vence en 7 días`} />
          ) : null}

          <DialogFooter className="-mx-6 -mb-6 px-6">
            {paso === "tipo" ? (
              <Boton variante="primaria" onClick={() => setPaso("quien")}>
                Continuar
              </Boton>
            ) : null}
            {paso === "quien" ? (
              <>
                <Boton variante="secundaria" onClick={() => setPaso("tipo")} disabled={ocupado}>
                  Atrás
                </Boton>
                <Boton variante="primaria" onClick={crear} disabled={!listoParaCrear || ocupado}>
                  {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : <LinkIcon aria-hidden />}
                  {ocupado ? "Creando…" : "Crear enlace"}
                </Boton>
              </>
            ) : null}
            {paso === "enlace" ? (
              <>
                <Boton variante="secundaria" onClick={() => cambiarAbierto(false)}>
                  Listo
                </Boton>
                <Boton variante="secundaria" render={<a href={url ?? ""} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
                  <ExternalLinkIcon aria-hidden />
                  Abrir
                </Boton>
                <BotonCopiar enlace={url ?? ""} descripcion={`Pásaselo a ${paraQuien} por el medio que ya usan.`} />
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
