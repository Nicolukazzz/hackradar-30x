"use client";

import { ExternalLinkIcon, LinkIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Boton } from "@/app/_componentes";
import { BotonCopiar, EnlaceGenerado } from "@/app/_componentes/invitacion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { PermisoUI } from "@/lib/auth/permisos";
import { generarCodigo } from "@/vinculos/codigo";

import { llamar } from "../../ajustes/equipo/_equipo/api";
import { CodigoProveedor } from "./codigo";

// "Crear enlace" (#85), en 3 pasos: nombre y correo del proveedor → código (se puede generar otro) → enlace y código
// para copiar. Los dos existen en claro solo en esta respuesta. No se envía ningún correo.

type Paso = "proveedor" | "codigo" | "listo";
type Creado = { url: string; codigo: string };

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CrearEnlace({ permiso }: { permiso: PermisoUI }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<Paso>("proveedor");
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [creado, setCreado] = useState<Creado | null>(null);
  const [ocupado, iniciar] = useTransition();

  const nombreLimpio = nombre.trim();
  const correoLimpio = correo.trim().toLowerCase();
  const correoInvalido = correo.trim() !== "" && !CORREO.test(correoLimpio);
  const proveedorListo = nombreLimpio.length >= 2 && CORREO.test(correoLimpio);

  function reiniciar() {
    setPaso("proveedor");
    setNombre("");
    setCorreo("");
    setCodigo("");
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
        const r = await llamar<Creado>("/api/proveedores/enlaces", "POST", { nombre: nombreLimpio, correo: correoLimpio, codigo });
        setCreado(r);
        setPaso("listo");
      } catch (e) {
        toast.error("No se creó el enlace", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  const numero = { proveedor: 1, codigo: 2, listo: 3 }[paso];
  const titulo = { proveedor: "¿Para qué proveedor?", codigo: "Código del proveedor", listo: "Enlace listo" }[paso];
  const descripcion = {
    proveedor: "Con este correo y el código entrará al portal para subir sus facturas.",
    codigo: "Un código de 8 caracteres que solo tendrá este proveedor. Si no te gusta, genera otro. Después también lo puedes cambiar.",
    listo: `Pásale a ${nombreLimpio} el enlace y el código por el medio que ya usan. Por seguridad no se vuelven a mostrar; el enlace vence en 30 días.`,
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
      <Boton
        variante="primaria"
        onClick={() => {
          setCodigo(generarCodigo()); // en el navegador al abrir: nunca el mismo código que otro render
          setAbierto(true);
        }}
      >
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

          {paso === "proveedor" ? (
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="enlace-nombre">Nombre del proveedor</FieldLabel>
                <Input id="enlace-nombre" autoComplete="off" autoFocus placeholder="Ej.: Estudio Nuevo S.A.S." maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-11" />
              </Field>
              <Field data-invalid={correoInvalido || undefined}>
                <FieldLabel htmlFor="enlace-correo">Correo del proveedor</FieldLabel>
                <Input
                  id="enlace-correo"
                  type="email"
                  autoComplete="off"
                  placeholder="facturacion@proveedor.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  aria-invalid={correoInvalido || undefined}
                  className="h-11"
                />
                {correoInvalido ? <FieldError>Escribe un correo válido.</FieldError> : <FieldDescription>Tendrá que escribir exactamente este correo para entrar.</FieldDescription>}
              </Field>
            </FieldGroup>
          ) : null}

          {paso === "codigo" ? <CodigoProveedor codigo={codigo} onOtro={() => setCodigo(generarCodigo())} deshabilitado={ocupado} /> : null}

          {paso === "listo" && creado ? (
            <div className="flex flex-col gap-4">
              <EnlaceGenerado enlace={creado.url} etiqueta="Enlace del portal" resumen={`${nombreLimpio} · ${correoLimpio} · vence en 30 días`} />
              <CodigoProveedor codigo={creado.codigo} />
            </div>
          ) : null}

          <DialogFooter className="-mx-6 -mb-6 px-6">
            {paso === "proveedor" ? (
              <Boton variante="primaria" onClick={() => setPaso("codigo")} disabled={!proveedorListo}>
                Continuar
              </Boton>
            ) : null}
            {paso === "codigo" ? (
              <>
                <Boton variante="secundaria" onClick={() => setPaso("proveedor")} disabled={ocupado}>
                  Atrás
                </Boton>
                <Boton variante="primaria" onClick={crear} disabled={ocupado}>
                  {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : <LinkIcon aria-hidden />}
                  {ocupado ? "Creando…" : "Crear enlace"}
                </Boton>
              </>
            ) : null}
            {paso === "listo" && creado ? (
              <>
                <Boton variante="secundaria" onClick={() => cambiarAbierto(false)}>
                  Listo
                </Boton>
                <Boton variante="secundaria" render={<a href={creado.url} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
                  <ExternalLinkIcon aria-hidden />
                  Abrir
                </Boton>
                <BotonCopiar enlace={creado.url} descripcion={`Pásaselo a ${nombreLimpio} junto con el código.`} />
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
