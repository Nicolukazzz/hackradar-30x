"use client";

import { InboxIcon, Loader2Icon, MailIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Boton, PildoraDecision } from "@/app/_componentes";
import { SubirDocumento } from "@/components/subir-documento";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DecisionAgente } from "@/dominio/tipos";
import { MAX_BYTES } from "@/ingesta/limites";

// "Recibir factura" de la Bandeja (§13.1): sin esperar a un canal, una persona del equipo sube el PDF o la foto
// (carga manual, #26) o un correo .eml como si hubiera llegado al buzón (#14, /api/canales/correo/simular).
// Lo que entra pasa por la misma ingesta y el mismo motor que los canales.

type ResultadoCorreo = { ref_interna: string; estado: DecisionAgente; explicacion: string; respuesta: { texto: string } | null };

function SimularCorreo({ alTerminar }: { alTerminar: () => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<{ tipo: "inicial" } | { tipo: "enviando" } | { tipo: "listo"; r: ResultadoCorreo } | { tipo: "error"; mensaje: string }>({
    tipo: "inicial",
  });

  async function enviar(archivo: File | undefined) {
    if (!archivo) return;
    if (archivo.size > MAX_BYTES) return setEstado({ tipo: "error", mensaje: "El correo supera los 10 MB." });
    setEstado({ tipo: "enviando" });
    try {
      const res = await fetch("/api/canales/correo/simular", { method: "POST", headers: { "content-type": "message/rfc822" }, body: await archivo.arrayBuffer() });
      const datos = (await res.json().catch(() => ({}))) as Partial<ResultadoCorreo> & { error?: string };
      if (!res.ok || !datos.ref_interna) throw new Error(datos.error ?? "No se pudo procesar el correo.");
      setEstado({ tipo: "listo", r: datos as ResultadoCorreo });
      alTerminar();
    } catch (e) {
      setEstado({ tipo: "error", mensaje: e instanceof Error ? e.message : "No se pudo procesar el correo." });
    } finally {
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-borde-fuerte bg-card px-6 py-10 text-center transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-subtle">
        <MailIcon aria-hidden className="size-8 text-muted-foreground" />
        <span className="text-base font-medium">Elige un correo .eml</span>
        <span className="text-sm text-muted-foreground">Se procesa como si hubiera llegado al buzón: remitente, cuerpo y adjuntos.</span>
        <input ref={entrada} type="file" accept=".eml,message/rfc822" className="sr-only" disabled={estado.tipo === "enviando"} onChange={(e) => void enviar(e.target.files?.[0])} />
      </label>
      <div aria-live="polite" className="min-h-6">
        {estado.tipo === "enviando" ? (
          <span className="flex items-center gap-2 text-sm">
            <Loader2Icon aria-hidden className="size-4 animate-spin" />
            El agente está revisando el correo…
          </span>
        ) : null}
        {estado.tipo === "listo" ? (
          <div className="flex flex-col gap-2 rounded-xl bg-subtle p-4 text-sm">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold tabular-nums">{estado.r.ref_interna}</span>
              <PildoraDecision decision={estado.r.estado} />
            </span>
            <span className="text-texto-3">{estado.r.explicacion}</span>
            {estado.r.respuesta ? <span className="text-xs text-muted-foreground">Respuesta al remitente: «{estado.r.respuesta.texto}»</span> : null}
            <Link href={`/facturas/${estado.r.ref_interna}`} className="self-start font-medium text-link hover:underline">
              Ver traza →
            </Link>
          </div>
        ) : null}
        {estado.tipo === "error" ? (
          <div role="alert" className="flex items-start gap-3 rounded-xl bg-frenada p-4 text-sm text-frenada-foreground">
            <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{estado.mensaje}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function RecibirFactura() {
  const router = useRouter();
  return (
    <Sheet>
      <SheetTrigger render={<Boton variante="secundaria" />}>
        <InboxIcon aria-hidden />
        Recibir factura
      </SheetTrigger>
      <SheetContent className="w-full gap-5 overflow-y-auto p-6 sm:max-w-md">
        <SheetHeader className="p-0">
          <SheetTitle className="text-lg">Recibir factura</SheetTitle>
          <SheetDescription>
            Pasa por la misma ingesta y las mismas reglas que los canales. El agente decide en segundos y lo deja en la Bandeja y en el registro.
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="archivo">
          <TabsList className="w-full">
            <TabsTrigger value="archivo" className="min-h-9">
              PDF o foto
            </TabsTrigger>
            <TabsTrigger value="correo" className="min-h-9">
              Correo (.eml)
            </TabsTrigger>
          </TabsList>
          <TabsContent value="archivo" className="flex flex-col gap-3 pt-3">
            <SubirDocumento alTerminar={() => router.refresh()} />
            <p className="text-xs text-muted-foreground">
              Llega como carga manual con tu correo como remitente. Si tu correo no está vinculado al beneficiario que cobra, la regla R11 la escala:
              nunca se paga sola.
            </p>
          </TabsContent>
          <TabsContent value="correo" className="pt-3">
            <SimularCorreo alTerminar={() => router.refresh()} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
