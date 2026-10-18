"use client";

import { CheckCircle2Icon, FileUpIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

import { Boton } from "@/app/_componentes";
import { Progress } from "@/components/ui/progress";
import { MAX_BYTES } from "@/ingesta/limites";
import type { ResultadoSubida } from "@/servicios/subida";

// Subida de una factura (#26): portal del proveedor (#12) y "Cargar factura" del panel (#6).
// Un archivo por vez, ≤ 10 MB, PDF/PNG/JPG/XML. El navegador solo pre-valida para avisar rápido:
// el servidor vuelve a validar todo (tipo real por magic bytes) y decide.
// Hecho a mano y no con el dropzone de @kibo-ui: ese depende de react-dropzone (dependencia nueva) y aquí
// basta un <label> con <input type="file"> nativo, accesible por teclado, para un solo archivo.

export const ACEPTA = ".pdf,.png,.jpg,.jpeg,.xml,application/pdf,image/png,image/jpeg,application/xml,text/xml";

type Estado =
  | { tipo: "inicial" }
  | { tipo: "subiendo"; nombre: string; progreso: number }
  | { tipo: "listo"; nombre: string; resultado: ResultadoSubida }
  | { tipo: "error"; mensaje: string };

/** Sube un archivo a `url` (multipart, campo `archivo`) informando el progreso. Lanza con el mensaje del servidor. */
export function enviarArchivo(url: string, archivo: File, alAvanzar: (pct: number) => void): Promise<ResultadoSubida> {
  return new Promise((resolver, rechazar) => {
    // XMLHttpRequest y no fetch: fetch no informa el progreso de subida.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && alAvanzar(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => rechazar(new Error("No hay conexión con el servidor. Intenta de nuevo."));
    xhr.onload = () => {
      let datos: Partial<ResultadoSubida> & { error?: string } = {};
      try {
        datos = JSON.parse(xhr.responseText);
      } catch {
        // respuesta sin JSON (proxy caído): mensaje genérico abajo
      }
      if (xhr.status >= 200 && xhr.status < 300 && datos.ref_interna) resolver(datos as ResultadoSubida);
      else rechazar(new Error(datos.error ?? "No se pudo subir el archivo."));
    };
    const f = new FormData();
    f.append("archivo", archivo);
    xhr.send(f);
  });
}

/**
 * Zona para subir una factura con progreso y resultado del agente. `url` cambia el destino (panel o portal del
 * proveedor).
 */
export function SubirDocumento({
  alTerminar,
  className,
  url = "/api/documentos",
}: {
  alTerminar?: (r: ResultadoSubida) => void;
  className?: string;
  /** a dónde se sube (por defecto, el panel) */
  url?: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });
  const [encima, setEncima] = useState(false);
  const ocupado = estado.tipo === "subiendo";

  async function subir(archivo: File | undefined) {
    if (!archivo || ocupado) return;
    if (archivo.size === 0) return setEstado({ tipo: "error", mensaje: "El archivo está vacío." });
    if (archivo.size > MAX_BYTES) return setEstado({ tipo: "error", mensaje: "El archivo supera los 10 MB." });
    setEstado({ tipo: "subiendo", nombre: archivo.name, progreso: 0 });
    try {
      const resultado = await enviarArchivo(url, archivo, (progreso) => setEstado({ tipo: "subiendo", nombre: archivo.name, progreso }));
      setEstado({ tipo: "listo", nombre: archivo.name, resultado });
      alTerminar?.(resultado);
    } catch (e) {
      setEstado({ tipo: "error", mensaje: e instanceof Error ? e.message : "No se pudo subir el archivo." });
    } finally {
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          if (e.dataTransfer.files.length > 1) return setEstado({ tipo: "error", mensaje: "Sube un archivo por vez." });
          void subir(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-borde-fuerte bg-card px-6 py-10 text-center transition-colors",
          "focus-within:ring-2 focus-within:ring-ring hover:bg-subtle",
          encima && "border-foreground bg-subtle",
          ocupado && "pointer-events-none opacity-70",
        )}
      >
        <FileUpIcon aria-hidden className="size-8 text-muted-foreground" />
        <span className="text-base font-medium">Arrastra la factura aquí o elige un archivo</span>
        <span className="text-sm text-muted-foreground">PDF o foto (JPG, PNG) · hasta 10 MB</span>
        <input
          ref={entrada}
          type="file"
          accept={ACEPTA}
          className="sr-only"
          disabled={ocupado}
          onChange={(e) => void subir(e.target.files?.[0])}
        />
      </label>

      <div aria-live="polite" className="min-h-6">
        {estado.tipo === "subiendo" ? (
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-sm">
              <Loader2Icon aria-hidden className="size-4 animate-spin" />
              {estado.progreso < 100 ? `Subiendo ${estado.nombre}…` : "El agente está revisando la factura…"}
            </span>
            <Progress value={estado.progreso} aria-label="Progreso de la subida" />
          </div>
        ) : null}
        {estado.tipo === "listo" ? (
          <div className="flex items-start gap-3 rounded-xl bg-subtle p-4 text-sm">
            <CheckCircle2Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-pagada-foreground" />
            <div className="flex flex-col gap-1">
              <span className="font-medium">
                Recibida · <span className="font-mono tabular-nums">{estado.resultado.ref_interna}</span>
              </span>
              <span className="text-muted-foreground">{estado.resultado.mensaje}</span>
              <Boton variante="fantasma" className="mt-1 self-start" onClick={() => setEstado({ tipo: "inicial" })}>
                Subir otra
              </Boton>
            </div>
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
