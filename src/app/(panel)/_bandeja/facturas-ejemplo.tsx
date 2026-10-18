"use client";

import { ArrowUpRightIcon, FileTextIcon, ImageIcon, Loader2Icon, SendIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Boton, PildoraDecision } from "@/app/_componentes";
import { llamar } from "@/app/_componentes/llamar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DecisionAgente } from "@/dominio/tipos";
import { cn } from "@/lib/utils";
import type { FacturaEjemplo } from "@/servicios/facturas-ejemplo";

// «Probar con facturas de ejemplo» (#162): el set de facturas-de-prueba/ dentro de la app. Cada factura se envía como
// la mandaría su proveedor por el portal y el resultado aparece al lado, junto a lo que se esperaba. Solo
// administradores en modo demo (la Bandeja no muestra el botón a nadie más).

type Resultado = { ref_interna: string; estado: DecisionAgente; mensaje: string };
type Estado = { tipo: "enviando" } | { tipo: "listo"; r: Resultado } | { tipo: "error"; mensaje: string };

const REPO = "https://github.com/Nicolukazzz/hackradar-30x/blob/main/facturas-de-prueba";

const TIPO: Record<FacturaEjemplo["efecto"], string> = { limpio: "", escaneo: "escaneada", foto: "foto", borroso: "foto movida" };

export function FacturasEjemplo() {
  const router = useRouter();
  const [facturas, setFacturas] = useState<FacturaEjemplo[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [lote, setLote] = useState<{ hechas: number; total: number } | null>(null);

  async function abrir(abierto: boolean) {
    if (!abierto || facturas || cargando) return;
    setCargando(true);
    try {
      setFacturas((await llamar<{ facturas: FacturaEjemplo[] }>("/api/demo/facturas", "GET")).facturas);
    } catch (e) {
      toast.error("No se pudieron cargar las facturas de ejemplo", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setCargando(false);
    }
  }

  async function enviar(f: FacturaEjemplo): Promise<boolean> {
    setEstados((s) => ({ ...s, [f.archivo]: { tipo: "enviando" } }));
    try {
      const r = await llamar<Resultado>("/api/demo/facturas", "POST", { archivo: f.archivo });
      setEstados((s) => ({ ...s, [f.archivo]: { tipo: "listo", r } }));
      return true;
    } catch (e) {
      setEstados((s) => ({ ...s, [f.archivo]: { tipo: "error", mensaje: e instanceof Error ? e.message : "No se pudo enviar." } }));
      return false;
    }
  }

  async function enviarUna(f: FacturaEjemplo) {
    await enviar(f);
    router.refresh();
  }

  async function enviarTodas(lista: FacturaEjemplo[]) {
    const pendientes = lista.filter((f) => estados[f.archivo]?.tipo !== "listo");
    setLote({ hechas: 0, total: pendientes.length });
    let ok = 0;
    for (const [i, f] of pendientes.entries()) {
      if (await enviar(f)) ok++;
      setLote({ hechas: i + 1, total: pendientes.length });
    }
    setLote(null);
    router.refresh();
    toast.success(`${ok} de ${pendientes.length} facturas enviadas`, { description: "El resultado de cada una está al lado. La Bandeja ya las muestra." });
  }

  const pagan = facturas?.filter((f) => f.carpeta === "pagan") ?? [];
  const trampas = facturas?.filter((f) => f.carpeta === "trampas") ?? [];

  return (
    <Sheet onOpenChange={abrir}>
      <SheetTrigger render={<Boton variante="secundaria" />}>
        <SparklesIcon aria-hidden />
        Probar con facturas de ejemplo
      </SheetTrigger>
      <SheetContent className="w-full gap-5 overflow-y-auto p-6 sm:max-w-2xl">
        <SheetHeader className="p-0">
          <SheetTitle className="text-lg">Facturas de ejemplo</SheetTitle>
          <SheetDescription>
            Cada una llega como si su proveedor la subiera por su portal. Las de «Se pagan solas» cumplen todo; cada trampa rompe una regla a propósito.
          </SheetDescription>
        </SheetHeader>

        {cargando || !facturas ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Cargando facturas…
          </p>
        ) : facturas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta instalación no trae el set de facturas de ejemplo.</p>
        ) : (
          <Tabs defaultValue="pagan" className="gap-4">
            <TabsList>
              <TabsTrigger value="pagan">Se pagan solas · {pagan.length}</TabsTrigger>
              <TabsTrigger value="trampas">Trampas · {trampas.length}</TabsTrigger>
            </TabsList>
            <TabsContent value="pagan" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-superficie-2 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  {lote ? `Enviando ${lote.hechas} de ${lote.total}…` : "Envía una por una o todas de una vez (las ya enviadas no se repiten)."}
                </p>
                <Boton variante="primaria" onClick={() => void enviarTodas(pagan)} disabled={lote !== null}>
                  {lote ? <Loader2Icon className="animate-spin" aria-hidden /> : <SendIcon aria-hidden />}
                  Enviar todas
                </Boton>
              </div>
              <Lista facturas={pagan} estados={estados} alEnviar={enviarUna} ocupado={lote !== null} />
            </TabsContent>
            <TabsContent value="trampas" className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                La 01 es una foto de la factura FE-2041: envía antes esa factura (en «Se pagan solas») para ver cómo se frena el cobro repetido.
              </p>
              <Lista facturas={trampas} estados={estados} alEnviar={enviarUna} ocupado={lote !== null} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Lista({
  facturas,
  estados,
  alEnviar,
  ocupado,
}: Readonly<{ facturas: FacturaEjemplo[]; estados: Record<string, Estado>; alEnviar: (f: FacturaEjemplo) => Promise<void>; ocupado: boolean }>) {
  return (
    <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
      {facturas.map((f) => (
        <Fila key={f.archivo} f={f} estado={estados[f.archivo]} alEnviar={alEnviar} ocupado={ocupado} />
      ))}
    </ul>
  );
}

function Fila({ f, estado, alEnviar, ocupado }: Readonly<{ f: FacturaEjemplo; estado: Estado | undefined; alEnviar: (f: FacturaEjemplo) => Promise<void>; ocupado: boolean }>) {
  const Icono = f.formato === "pdf" ? FileTextIcon : ImageIcon;
  const tipo = [f.formato.toUpperCase(), TIPO[f.efecto]].filter(Boolean).join(" · ");
  const enviando = estado?.tipo === "enviando";
  return (
    <li className="flex flex-col gap-2.5 px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-8 flex-none items-center justify-center rounded-[9px] bg-superficie-2 text-muted-foreground">
            <Icono className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm leading-snug font-medium">
              {f.proveedor}
              {f.numero ? <span className="font-mono text-[13px] text-muted-foreground"> · {f.numero}</span> : null}
            </p>
            <p className="text-[13px] text-muted-foreground">
              {tipo}
              {f.total ? <span className="font-mono tabular-nums"> · {f.total}</span> : null}
              {" · "}
              <a href={`${REPO}/${f.carpeta}/${f.archivo}`} target="_blank" rel="noreferrer" className="text-link hover:underline">
                ver archivo
              </a>
            </p>
          </div>
        </div>
        {estado?.tipo === "listo" ? null : (
          <Boton variante="secundaria" onClick={() => void alEnviar(f)} disabled={enviando || ocupado} className="flex-none">
            {enviando ? <Loader2Icon className="animate-spin" aria-hidden /> : <SendIcon aria-hidden />}
            {enviando ? "Enviando…" : "Enviar"}
          </Boton>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-11 text-[13px]">
        <span className="text-muted-foreground">Esperado:</span>
        <PildoraDecision decision={f.esperado} />
        {f.reglas.length > 0 ? <span className="font-mono text-muted-foreground">{f.reglas.join(", ")}</span> : null}
        <span className="basis-full text-muted-foreground">{f.motivo}</span>
      </div>

      {estado?.tipo === "listo" ? (
        <div
          className={cn(
            "ml-11 flex animate-in flex-wrap items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] duration-200 fade-in",
            estado.r.estado === f.esperado ? "bg-pagada/60" : "bg-escalada/60",
          )}
        >
          <span className="font-medium">{estado.r.estado === f.esperado ? "Resultado igual al esperado:" : "Resultado:"}</span>
          <PildoraDecision decision={estado.r.estado} />
          <Link href={`/facturas/${estado.r.ref_interna}`} className="inline-flex items-center gap-1 font-mono text-link hover:underline">
            {estado.r.ref_interna}
            <ArrowUpRightIcon className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : null}
      {estado?.tipo === "error" ? <p className="ml-11 text-[13px] text-frenada-foreground">{estado.mensaje}</p> : null}
    </li>
  );
}
