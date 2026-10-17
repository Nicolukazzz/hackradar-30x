import { ExternalLinkIcon, ShieldAlertIcon } from "lucide-react";
import Image from "next/image";

import { Tarjeta, TarjetaEncabezado } from "@/app/_componentes";
import { normalizarTexto } from "@/dominio/normalizar";
import type { RespuestaFactura } from "@/app/_datos/facturas";

import { Resaltado, type Marca } from "./resaltar";

// "Documento original" (§13.2): el archivo tal como llegó, con los datos extraídos (azul) y las
// instrucciones dirigidas al agente (ámbar, R10) resaltados donde el documento es texto.

function descripcion(f: RespuestaFactura): string {
  const doc = f.documento;
  const adj = doc?.adjuntos[0];
  const esPdf = adj?.mime === "application/pdf";
  const esImagen = adj?.mime.startsWith("image/") ?? false;
  if (f.entrada.canal === "correo") return esPdf ? "Correo con PDF adjunto" : esImagen ? "Correo con foto adjunta" : "Correo";
  if (f.entrada.canal === "telegram") return esImagen ? "Foto por Telegram" : "Mensaje de Telegram";
  if (f.entrada.canal === "portal") return "PDF subido al portal";
  return "Documento cargado a mano";
}

function Archivo({ f }: { f: RespuestaFactura }) {
  const ref = f.entrada.ref_interna;
  const adj = f.documento?.adjuntos[0];
  if (!adj) return null;
  // En un correo, el archivo original es el .eml: el PDF o la foto se piden como adjunto 0.
  const url = `/api/documentos/${encodeURIComponent(ref)}/archivo${f.entrada.canal === "correo" ? "?adjunto=0" : ""}`;
  if (adj.mime.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noopener" className="block overflow-hidden rounded-xl ring-1 ring-border">
        <Image src={url} alt={`Foto de la factura ${f.entrada.factura_numero ?? ref}`} width={850} height={1100} unoptimized className="h-auto w-full bg-muted" />
      </a>
    );
  }
  if (adj.mime === "application/pdf") {
    return (
      <div className="flex flex-col gap-2">
        {/* En móvil un PDF embebido se ve mal: solo el enlace. */}
        <iframe src={`${url}#navpanes=0&view=FitH`} title={`PDF de la factura ${f.entrada.factura_numero ?? ref}`} className="hidden h-[560px] w-full rounded-xl bg-muted ring-1 ring-border md:block" />
        <a href={url} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-link hover:underline">
          <ExternalLinkIcon className="size-4" aria-hidden />
          Abrir {adj.nombre}
        </a>
      </div>
    );
  }
  return null;
}

/** Las oraciones completas del documento que contienen algún fragmento detectado (para citarlas enteras). */
function oracionesSospechosas(f: RespuestaFactura): string[] {
  const textos = [f.documento?.asunto, f.documento?.texto_mensaje, f.extraccion?.texto_crudo].filter((t): t is string => Boolean(t));
  const fragmentos = f.instrucciones_detectadas.map((x) => normalizarTexto(x));
  const oraciones = new Set<string>();
  for (const t of textos) {
    for (const o of t.split(/(?<=[.!?])\s+|\n+/)) {
      const limpia = o.trim();
      if (limpia && fragmentos.some((fr) => normalizarTexto(limpia).includes(fr))) oraciones.add(limpia);
    }
  }
  return oraciones.size > 0 ? [...oraciones] : f.instrucciones_detectadas;
}

export function VisorDocumento({ f }: { f: RespuestaFactura }) {
  const doc = f.documento;
  const ext = f.extraccion;
  const marcas: Marca[] = [
    ...f.instrucciones_detectadas.map((t) => ({ texto: t, tipo: "sospechoso" as const })),
    ...[ext?.numero.valor, ext?.beneficiario_nombre.valor, ext?.concepto.valor].filter((v): v is string => Boolean(v)).map((t) => ({ texto: t, tipo: "dato" as const })),
  ];
  const remitente = doc?.remitente.valor;

  return (
    <Tarjeta as="section" aria-labelledby="doc">
      <TarjetaEncabezado id="doc" titulo="Documento original" descripcion={descripcion(f)} />
      <div className="flex flex-col gap-4 border-t border-border px-6 py-5">
        {doc?.texto_mensaje || doc?.asunto ? (
          <div className={f.entrada.canal === "telegram" ? "max-w-[480px] self-start rounded-2xl rounded-tl-sm bg-superficie-2 px-4 py-3 ring-1 ring-border" : "rounded-xl bg-superficie-2 px-4 py-3 ring-1 ring-border"}>
            {f.entrada.canal === "correo" ? (
              <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-border pb-3 text-[13px]">
                <dt className="text-muted-foreground">De</dt>
                <dd className="font-mono break-all">{remitente}</dd>
                {doc.asunto ? (
                  <>
                    <dt className="text-muted-foreground">Asunto</dt>
                    <dd className="font-medium">
                      <Resaltado texto={doc.asunto} marcas={marcas} />
                    </dd>
                  </>
                ) : null}
              </dl>
            ) : (
              <p className="mb-1.5 text-xs text-muted-foreground">
                {f.entrada.canal === "telegram" ? "Telegram" : "Mensaje"} · <span className="font-mono">{remitente}</span>
              </p>
            )}
            {doc.texto_mensaje ? (
              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                <Resaltado texto={doc.texto_mensaje} marcas={marcas} />
              </p>
            ) : null}
          </div>
        ) : null}

        <Archivo f={f} />

        {f.instrucciones_detectadas.length > 0 ? (
          <div role="note" className="flex gap-3 rounded-xl bg-escalada px-4 py-3 text-escalada-foreground ring-1 ring-escalada-punto/30">
            <ShieldAlertIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold">Instrucción embebida · ignorada (R10)</span>
              {oracionesSospechosas(f).map((o) => (
                <span key={o} className="text-sm">
                  «{o}»
                </span>
              ))}
              <span className="text-xs">El agente trata el documento como dato: este texto nunca se obedece y la factura quedó marcada.</span>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-[3px] bg-[#e6eeff]" />
            Dato extraído
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-[3px] bg-escalada ring-1 ring-escalada-punto/40" />
            Texto sospechoso, nunca se obedece
          </span>
        </div>
      </div>
    </Tarjeta>
  );
}
