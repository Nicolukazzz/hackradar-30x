"use client";

import { CheckIcon, CopyIcon, Loader2Icon, SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Boton } from "@/app/_componentes";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { llamar } from "../../equipo/_equipo/api";

// "Invitar proveedor" (#28), en 3 pasos: quién (2 campos opcionales) → vigencia y envíos → enlace para copiar.
// El enlace lleva el token en claro y solo existe en esta respuesta.

const VIGENCIAS = [
  { value: "1", label: "1 día" },
  { value: "7", label: "7 días" },
  { value: "14", label: "14 días" },
  { value: "30", label: "30 días" },
];
const USOS = [
  { value: "1", label: "1 factura" },
  { value: "3", label: "3 facturas" },
  { value: "5", label: "5 facturas" },
  { value: "10", label: "10 facturas" },
];

type Paso = "quien" | "limites" | "enlace";
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InvitarProveedor() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<Paso>("quien");
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [dias, setDias] = useState("7");
  const [usos, setUsos] = useState("5");
  const [enlace, setEnlace] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, iniciar] = useTransition();
  const correoInvalido = correo.trim() !== "" && !CORREO.test(correo.trim());

  function reiniciar() {
    setPaso("quien");
    setNombre("");
    setCorreo("");
    setDias("7");
    setUsos("5");
    setEnlace(null);
    setCopiado(false);
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
        const r = await llamar<{ enlace: string }>("/api/invitaciones-proveedor", "POST", {
          nombre_esperado: nombre.trim() || null,
          correo_esperado: correo.trim() || null,
          dias_vigencia: Number(dias),
          usos_max: Number(usos),
        });
        setEnlace(r.enlace);
        setPaso("enlace");
      } catch (e) {
        toast.error("No se creó el enlace", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  async function copiar() {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      toast.success("Enlace copiado", { description: "Envíaselo al proveedor por correo, WhatsApp o el medio que prefieras." });
    } catch {
      toast.error("No se pudo copiar", { description: "Selecciona el enlace y cópialo a mano." });
    }
  }

  const titulo = paso === "quien" ? "¿A quién invitas?" : paso === "limites" ? "¿Por cuánto tiempo?" : "Enlace listo";
  const descripcion =
    paso === "quien"
      ? "Para un proveedor o contratista que todavía no está en la lista. Ambos campos son opcionales."
      : paso === "limites"
        ? "El enlace vence solo y deja de servir después de las facturas que elijas."
        : "Cópialo ahora: por seguridad no se vuelve a mostrar. Quien lo abra crea su cuenta, confirma su correo y sube la factura.";

  return (
    <>
      <Boton variante="primaria" onClick={() => setAbierto(true)}>
        <SendIcon aria-hidden />
        Invitar proveedor
      </Boton>
      <Dialog open={abierto} onOpenChange={cambiarAbierto}>
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader>
            <span className="text-xs text-muted-foreground">Paso {paso === "quien" ? 1 : paso === "limites" ? 2 : 3} de 3</span>
            <DialogTitle className="text-lg">{titulo}</DialogTitle>
            <DialogDescription>{descripcion}</DialogDescription>
          </DialogHeader>

          {paso === "quien" ? (
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="prov-nombre">Nombre del proveedor</FieldLabel>
                <Input id="prov-nombre" autoComplete="off" placeholder="Ej.: Estudio Nuevo S.A.S." maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-11" />
                <FieldDescription>Solo para reconocer el enlace en la lista.</FieldDescription>
              </Field>
              <Field data-invalid={correoInvalido || undefined}>
                <FieldLabel htmlFor="prov-correo">Correo del proveedor</FieldLabel>
                <Input
                  id="prov-correo"
                  type="email"
                  autoComplete="off"
                  placeholder="facturacion@proveedor.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  aria-invalid={correoInvalido || undefined}
                  className="h-11"
                />
                {correoInvalido ? <FieldError>Escribe un correo válido o déjalo vacío.</FieldError> : <FieldDescription>Si lo escribes, solo una cuenta con ese correo podrá enviar.</FieldDescription>}
              </Field>
            </FieldGroup>
          ) : null}

          {paso === "limites" ? (
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="prov-vigencia">Vence en</FieldLabel>
                <Select items={VIGENCIAS} value={dias} onValueChange={(v) => v && setDias(v)}>
                  <SelectTrigger id="prov-vigencia" className="w-full data-[size=default]:h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VIGENCIAS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="prov-usos">Puede enviar hasta</FieldLabel>
                <Select items={USOS} value={usos} onValueChange={(v) => v && setUsos(v)}>
                  <SelectTrigger id="prov-usos" className="w-full data-[size=default]:h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USOS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>Todo lo que llegue por el enlace lo revisa una persona antes de pagar.</FieldDescription>
              </Field>
            </FieldGroup>
          ) : null}

          {paso === "enlace" && enlace ? (
            <div className="flex flex-col gap-2">
              <Input readOnly value={enlace} aria-label="Enlace para el proveedor" onFocus={(e) => e.target.select()} className="h-11 font-mono text-xs" />
              <p className="text-[13px] text-muted-foreground">
                {nombre.trim() || "Proveedor nuevo"} · vence en {VIGENCIAS.find((v) => v.value === dias)?.label} · hasta {USOS.find((v) => v.value === usos)?.label}
                {correo.trim() ? ` · solo ${correo.trim().toLowerCase()}` : ""}
              </p>
            </div>
          ) : null}

          <DialogFooter className="-mx-6 -mb-6 px-6">
            {paso === "quien" ? (
              <Boton variante="primaria" onClick={() => setPaso("limites")} disabled={correoInvalido}>
                Continuar
              </Boton>
            ) : null}
            {paso === "limites" ? (
              <>
                <Boton variante="secundaria" onClick={() => setPaso("quien")} disabled={ocupado}>
                  Atrás
                </Boton>
                <Boton variante="primaria" onClick={crear} disabled={ocupado}>
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
                <Boton variante="primaria" onClick={copiar}>
                  {copiado ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
                  {copiado ? "Copiado" : "Copiar enlace"}
                </Boton>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
