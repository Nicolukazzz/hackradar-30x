"use client";

import { Building2Icon, ClockIcon, GlobeIcon, Loader2Icon, MapPinIcon, BanknoteIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Boton } from "@/app/_componentes";
import { FilaAjuste, GrupoAjustes } from "@/app/_componentes/ajustes";
import { llamar } from "@/app/_componentes/llamar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Empresa } from "@/dominio/tipos";
import { CODIGOS_PAIS, nombrePaises, PAISES, type CodigoPais } from "@/empresa/datos";

// Edición en línea (#84): cada fila abre un diálogo con un solo campo; al guardar, toast y la página se recarga
// con el dato nuevo (también la barra lateral y el título).

type Campo = "nombre" | "jurisdiccion" | "paises_operacion";

const TEXTOS: Record<Campo, { titulo: string; descripcion: string }> = {
  nombre: { titulo: "Nombre de la empresa", descripcion: "Se ve en el panel, en los correos a empleados y proveedores y en el título." },
  jurisdiccion: { titulo: "Jurisdicción", descripcion: "Dónde está constituida, por ejemplo «Delaware, EE. UU.»." },
  paises_operacion: { titulo: "Países donde opera", descripcion: "Donde tiene equipo, proveedores o contratistas." },
};

export function DatosEmpresa({ empresa, editable }: { empresa: Empresa; editable: boolean }) {
  const router = useRouter();
  const [campo, setCampo] = useState<Campo | null>(null);
  const [texto, setTexto] = useState("");
  const [paises, setPaises] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  function abrir(c: Campo) {
    setCampo(c);
    setError(null);
    if (c === "paises_operacion") setPaises(empresa.paises_operacion);
    else setTexto(empresa[c]);
  }

  function guardar() {
    if (!campo) return;
    const valor = campo === "paises_operacion" ? paises : texto.trim();
    if (campo !== "paises_operacion" && !valor.length) return setError("No puede quedar vacío.");
    if (campo === "paises_operacion" && !valor.length) return setError("Elige al menos un país.");
    iniciar(async () => {
      try {
        const r = await llamar<{ entrada: { id: string } | null }>("/api/empresa", "PATCH", { [campo]: valor });
        toast.success(r.entrada ? "Guardado" : "Sin cambios", { description: r.entrada ? `Quedó en el registro (${r.entrada.id}).` : undefined });
        setCampo(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  const pulsar = (c: Campo) => (editable ? () => abrir(c) : undefined);
  const textos = campo ? TEXTOS[campo] : null;

  return (
    <div className="flex max-w-[680px] flex-col gap-7">
      <GrupoAjustes titulo="Empresa">
        <FilaAjuste icono={Building2Icon} color="azul" titulo="Nombre" valor={empresa.nombre} alPulsar={pulsar("nombre")} />
        <FilaAjuste icono={MapPinIcon} color="gris" titulo="Jurisdicción" valor={empresa.jurisdiccion} alPulsar={pulsar("jurisdiccion")} />
        <FilaAjuste
          icono={GlobeIcon}
          color="verde"
          titulo="Países"
          valor={`${empresa.paises_operacion.length} · ${empresa.paises_operacion.join(", ")}`}
          alPulsar={pulsar("paises_operacion")}
        />
      </GrupoAjustes>

      <GrupoAjustes titulo="Dinero y hora" pie="La moneda base se elige en Moneda y tasas (próximamente). La hora de las decisiones usa esta zona horaria.">
        <FilaAjuste icono={BanknoteIcon} color="verde" titulo="Moneda base" valor={empresa.moneda_base} />
        <FilaAjuste icono={ClockIcon} color="gris" titulo="Zona horaria" valor={empresa.zona_horaria} />
      </GrupoAjustes>

      <Dialog open={campo !== null} onOpenChange={(a) => !a && !guardando && setCampo(null)}>
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">{textos?.titulo}</DialogTitle>
            <DialogDescription>{textos?.descripcion}</DialogDescription>
          </DialogHeader>

          {campo === "nombre" || campo === "jurisdiccion" ? (
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="dato-empresa" className="sr-only">
                {textos?.titulo}
              </FieldLabel>
              <Input
                id="dato-empresa"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && guardar()}
                maxLength={120}
                autoFocus
                aria-invalid={error ? true : undefined}
                className="h-11"
              />
              {error ? <FieldError>{error}</FieldError> : <FieldDescription>Hasta 120 caracteres.</FieldDescription>}
            </Field>
          ) : null}

          {campo === "paises_operacion" ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="sr-only">{textos?.titulo}</legend>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {CODIGOS_PAIS.map((c: CodigoPais) => (
                  <label key={c} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-2 text-[15px] hover:bg-superficie-2">
                    <Checkbox
                      checked={paises.includes(c)}
                      onCheckedChange={(v) => setPaises((ps) => (v ? [...ps, c] : ps.filter((x) => x !== c)))}
                    />
                    {PAISES[c]}
                  </label>
                ))}
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">{paises.length ? nombrePaises(CODIGOS_PAIS.filter((c) => paises.includes(c))) : "Ninguno elegido."}</p>
              )}
            </fieldset>
          ) : null}

          <DialogFooter className="-mx-6 -mb-6 px-6">
            <Boton variante="secundaria" onClick={() => setCampo(null)} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton variante="primaria" onClick={guardar} disabled={guardando}>
              {guardando ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
              {guardando ? "Guardando…" : "Guardar"}
            </Boton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
