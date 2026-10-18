"use client";

import { CheckCircle2Icon, ChevronDownIcon, FileTextIcon, FileUpIcon, Loader2Icon, LogOutIcon, SendIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Boton } from "@/app/_componentes";
import { ACEPTA, enviarArchivo } from "@/components/subir-documento";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MAX_BYTES } from "@/ingesta/limites";
import { cn } from "@/lib/utils";

// «Ingrese sus facturas» (#85): el proveedor elige o arrastra varias facturas, revisa la lista y las envía con un botón.
// Se suben una por una al mismo endpoint (un archivo por petición, como el resto de canales): cada una pasa por la
// ingesta y el motor por separado, y si una falla las demás igual quedan enviadas. El servidor vuelve a validar todo.

const MAX_POR_ENVIO = 10;
const EXTENSIONES = /\.(pdf|png|jpe?g|xml)$/i;

type Estado = { tipo: "pendiente" } | { tipo: "subiendo"; progreso: number } | { tipo: "enviada"; ref: string; mensaje: string } | { tipo: "error"; mensaje: string };
type Item = { id: string; archivo: File; estado: Estado };

const clave = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

function tamano(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function SubirFacturas({ token }: { token: string }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const porEnviar = items.filter((i) => i.estado.tipo === "pendiente" || i.estado.tipo === "error");
  const enviadas = items.filter((i) => i.estado.tipo === "enviada").length;
  const url = `/api/vincular/${encodeURIComponent(token)}/facturas`;

  function cambiar(id: string, estado: Estado) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, estado } : x)));
  }

  function agregar(lista: FileList | null) {
    if (!lista || enviando) return;
    // Lo ya enviado sale de la lista al agregar más: la lista es lo que falta enviar.
    const actuales = items.filter((x) => x.estado.tipo !== "enviada");
    const vistas = new Set(actuales.map((x) => clave(x.archivo)));
    const nuevas: Item[] = [];
    const descartadas: string[] = [];
    for (const f of Array.from(lista)) {
      if (vistas.has(clave(f))) continue;
      if (!EXTENSIONES.test(f.name)) descartadas.push(`${f.name} (solo PDF, PNG, JPG o XML)`);
      else if (f.size === 0) descartadas.push(`${f.name} (está vacío)`);
      else if (f.size > MAX_BYTES) descartadas.push(`${f.name} (supera 10 MB)`);
      else if (actuales.length + nuevas.length >= MAX_POR_ENVIO) descartadas.push(`${f.name} (máximo ${MAX_POR_ENVIO} por envío)`);
      else {
        vistas.add(clave(f));
        nuevas.push({ id: crypto.randomUUID(), archivo: f, estado: { tipo: "pendiente" } });
      }
    }
    setItems([...actuales, ...nuevas]);
    setAviso(descartadas.length > 0 ? `No se agregaron: ${descartadas.join(", ")}.` : null);
    if (entrada.current) entrada.current.value = "";
  }

  async function enviar() {
    if (enviando || porEnviar.length === 0) return;
    setEnviando(true);
    setAviso(null);
    for (const item of porEnviar) {
      cambiar(item.id, { tipo: "subiendo", progreso: 0 });
      try {
        const r = await enviarArchivo(url, item.archivo, (progreso) => cambiar(item.id, { tipo: "subiendo", progreso }));
        cambiar(item.id, { tipo: "enviada", ref: r.ref_interna, mensaje: r.mensaje });
      } catch (e) {
        cambiar(item.id, { tipo: "error", mensaje: e instanceof Error ? e.message : "No se pudo enviar." });
      }
    }
    setEnviando(false);
    router.refresh(); // «Tus facturas» con lo recién enviado
  }

  return (
    <div className="flex flex-col gap-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          agregar(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-borde-fuerte bg-card px-6 py-10 text-center transition-colors",
          "focus-within:ring-2 focus-within:ring-ring hover:bg-subtle",
          encima && "border-foreground bg-subtle",
          enviando && "pointer-events-none opacity-70",
        )}
      >
        <FileUpIcon aria-hidden className="size-8 text-muted-foreground" />
        <span className="text-base font-medium">Arrastra tus facturas aquí o elige los archivos</span>
        <span className="text-sm text-muted-foreground">PDF, PNG, JPG o XML · hasta {MAX_POR_ENVIO} por envío · 10 MB cada una</span>
        <input ref={entrada} type="file" multiple accept={ACEPTA} className="sr-only" disabled={enviando} onChange={(e) => agregar(e.target.files)} />
      </label>

      {aviso ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-escalada px-4 py-3 text-sm text-escalada-foreground">
          <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 flex-none" />
          {aviso}
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col divide-y rounded-xl border" aria-label="Facturas por enviar" aria-live="polite">
            {items.map((i) => (
              <li key={i.id} className="flex items-start gap-3 px-4 py-3">
                <FileTextIcon aria-hidden className="mt-0.5 size-4 flex-none text-muted-foreground" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{i.archivo.name}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {i.estado.tipo === "pendiente" ? tamano(i.archivo.size) : null}
                    {i.estado.tipo === "subiendo" ? (i.estado.progreso < 100 ? `Enviando… ${i.estado.progreso} %` : "El agente la está revisando…") : null}
                    {i.estado.tipo === "enviada" ? (
                      <>
                        Enviada · <span className="font-mono tabular-nums">{i.estado.ref}</span> · {i.estado.mensaje}
                      </>
                    ) : null}
                    {i.estado.tipo === "error" ? <span className="text-frenada-foreground">{i.estado.mensaje}</span> : null}
                  </span>
                </span>
                {i.estado.tipo === "subiendo" ? <Loader2Icon aria-hidden className="mt-0.5 size-4 flex-none animate-spin" /> : null}
                {i.estado.tipo === "enviada" ? <CheckCircle2Icon aria-label="Enviada" className="mt-0.5 size-4 flex-none text-pagada-punto" /> : null}
                {i.estado.tipo === "pendiente" || i.estado.tipo === "error" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="-my-1.5 size-9 flex-none"
                    disabled={enviando}
                    aria-label={`Quitar ${i.archivo.name}`}
                    onClick={() => setItems((xs) => xs.filter((x) => x.id !== i.id))}
                  >
                    <XIcon aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {enviando
                ? "Enviando… no cierres esta página."
                : porEnviar.length > 0
                  ? `${porEnviar.length} ${porEnviar.length === 1 ? "factura lista" : "facturas listas"} para enviar`
                  : `${enviadas} ${enviadas === 1 ? "factura enviada" : "facturas enviadas"}. Puedes agregar más.`}
            </span>
            <div className="flex flex-wrap gap-2">
              {porEnviar.length > 0 && !enviando ? (
                <Boton variante="secundaria" onClick={() => setItems((xs) => xs.filter((x) => x.estado.tipo === "enviada"))}>
                  Quitar todas
                </Boton>
              ) : null}
              {porEnviar.length > 0 || enviando ? (
                <Boton variante="primaria" onClick={() => void enviar()} disabled={enviando}>
                  {enviando ? <Loader2Icon className="animate-spin" aria-hidden /> : <SendIcon aria-hidden />}
                  {enviando ? "Enviando…" : porEnviar.length > 1 ? `Enviar ${porEnviar.length} facturas` : "Enviar factura"}
                </Boton>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Iniciales para el avatar: "Hot Dogs Rincon" → "HR". */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.length > 1 ? [partes[0], partes.at(-1)] : partes;
  return letras.map((p) => p?.[0]?.toUpperCase() ?? "").join("") || "?";
}

/**
 * Cuenta del proveedor en la barra superior (como en cualquier web): avatar con iniciales y nombre; al tocarlo, un menú
 * con su correo y «Cerrar sesión».
 */
export function CuentaProveedor({ token, nombre, correo }: Readonly<{ token: string; nombre: string; correo: string }>) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  function salir() {
    iniciar(async () => {
      await fetch(`/api/vincular/${encodeURIComponent(token)}`, { method: "DELETE" }).catch(() => null);
      router.replace(`/vincular/${encodeURIComponent(token)}`);
    });
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex min-h-11 items-center gap-2.5 rounded-full py-1 pr-3 pl-1 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted"
            aria-label={`Cuenta de ${nombre}`}
          />
        }
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{iniciales(nombre)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-[180px] truncate text-sm font-medium sm:inline">{nombre}</span>
        <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-2">
            <span className="truncate text-sm font-semibold text-foreground">{nombre}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{correo}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className="min-h-10 px-2" disabled={ocupado} onClick={salir}>
          {ocupado ? <Loader2Icon className="animate-spin" aria-hidden /> : <LogOutIcon aria-hidden />}
          {ocupado ? "Cerrando sesión…" : "Cerrar sesión"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
