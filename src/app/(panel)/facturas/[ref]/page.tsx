import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Boton, Monto, PanelDecision, PildoraDecision, Tarjeta, etiquetaCanal, fechaCorta, fechaHora, hora } from "@/app/_componentes";
import { obtenerFactura, type RespuestaFactura } from "@/app/_datos/facturas";
import { aprobadorDeLaCuenta } from "@/app/api/_identidad";
import { permisoPara } from "@/lib/auth/permisos";
import { obtenerSesion } from "@/lib/auth/sesion";
import { cn } from "@/lib/utils";

import { DatosExtraidos, LineaDeTiempo, TrazaReglas } from "./secciones";
import { VisorDocumento } from "./visor-documento";

// Traza de decisión (especificación §13.2, prototipo pantalla 2).

export async function generateMetadata({ params }: PageProps<"/facturas/[ref]">): Promise<Metadata> {
  const { ref } = await params;
  const f = await obtenerFactura(ref);
  return { title: f ? `${f.entrada.factura_numero ?? ref} · traza de decisión` : "Factura no encontrada" };
}

const TITULO_PORQUE: Record<string, string> = {
  PAGAR: "Por qué el agente la pagó",
  FRENAR: "Por qué el agente no la pagó",
  ESCALAR: "Por qué el agente no la pagó",
  RECHAZADA_NO_FACTURA: "Por qué no se procesó como factura",
};

const SIN_DECISION: Record<string, string> = {
  PAGAR: "El agente la pagó solo: cumple todas las reglas, no necesita una persona.",
  FRENAR: "Las facturas frenadas no se aprueban: el proveedor la corrige y la vuelve a enviar.",
};

function Dato({ etiqueta, children, alerta = false }: { etiqueta: string; children: React.ReactNode; alerta?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className={cn("text-sm font-semibold", alerta && "text-frenada-foreground")}>{children}</dd>
    </div>
  );
}

function resumenReglas(f: RespuestaFactura): string {
  const r = f.resumen;
  const partes = [`${r.cumplen + r.no_aplican} cumplen`];
  if (r.frenan) partes.push(`${r.frenan} frenan`);
  if (r.escalan) partes.push(`${r.escalan} escalan`);
  return `v${r.version} · ${partes.join(", ")}`;
}

function PorQue({ f }: { f: RespuestaFactura }) {
  const e = f.entrada;
  return (
    <Tarjeta as="section" aria-labelledby="porque" className="gap-5 px-6 py-[22px] lg:flex-row lg:items-start lg:justify-between">
      <div className="flex max-w-[620px] flex-col gap-2">
        <h2 id="porque" className="text-[17px] font-semibold tracking-tight">
          {TITULO_PORQUE[e.decision ?? ""] ?? "Decisión del agente"}
        </h2>
        <p className="text-[15px] leading-relaxed text-pretty">{e.explicacion}</p>
      </div>
      <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-superficie-2 p-4 ring-1 ring-border sm:min-w-[340px]">
        {f.asignacion ? (
          <>
            <Dato etiqueta="Asignada a">
              {f.asignacion.aprobador.nombre} · {f.asignacion.aprobador.rol}
            </Dato>
            <Dato etiqueta="Responder antes de" alerta={f.asignacion.urgente}>
              {f.asignacion.urgente ? `Hoy, ${hora(f.asignacion.responder_antes_de)}` : fechaHora(f.asignacion.responder_antes_de)}
            </Dato>
            <Dato etiqueta="Reservado">
              <Monto usd={f.reservado_usd} />
            </Dato>
          </>
        ) : (
          <>
            <Dato etiqueta="Monto en USD">
              <Monto usd={e.monto_usd_centavos} />
            </Dato>
            <Dato etiqueta="Tasa usada">{e.tasa_usada ? <span className="font-mono">{e.tasa_usada}</span> : "No aplica (USD)"}</Dato>
            <Dato etiqueta="Estado">
              <PildoraDecision decision={f.estado} />
            </Dato>
          </>
        )}
        <Dato etiqueta="Reglas">{resumenReglas(f)}</Dato>
      </dl>
    </Tarjeta>
  );
}

async function DecisionHumana({ f }: { f: RespuestaFactura }) {
  const e = f.entrada;
  const pendiente = f.estado === "ESCALAR";
  // Todas las decisiones humanas, también la primera de dos firmas (decision null): su comentario es parte de la traza.
  const humanas = f.decisiones_humanas;
  // Roles (#51): decide solo quien tiene `aprobar`; si no, se muestra el motivo. aprobadorDeLaCuenta lanza sin rol,
  // por eso se llama solo después de confirmar el permiso.
  const sesion = pendiente ? await obtenerSesion() : null;
  const permiso = permisoPara(sesion, "aprobar");
  const cuenta = sesion && permiso.ok ? aprobadorDeLaCuenta(sesion) : null;
  const actual = cuenta ? { id: cuenta.id, nombre: cuenta.nombre, limite_usd: cuenta.limite_usd } : null;

  return (
    <Tarjeta as="section" id="decidir" aria-labelledby="hum" className={cn("scroll-mt-20 gap-3.5 p-[22px]", pendiente && "ring-2 ring-primary")}>
      <div className="flex flex-col gap-1">
        <h2 id="hum" className="text-[17px] font-semibold tracking-tight">
          Decisión humana
        </h2>
        <p className="text-[13px] text-muted-foreground">Tu decisión y tu comentario quedan en el registro junto con la traza del agente.</p>
      </div>
      {humanas.map((h) => (
        <div key={h.id} className="flex flex-col gap-1.5 rounded-xl bg-superficie-2 px-4 py-3 ring-1 ring-border">
          <span className="flex flex-wrap items-center gap-2">
            {h.decision ? (
              <PildoraDecision decision={h.decision} />
            ) : (
              <span className="rounded-full bg-escalada px-2.5 py-1 text-xs font-semibold text-escalada-foreground">Primera firma · 1 de 2</span>
            )}
            <span className="text-xs text-muted-foreground">
              {fechaCorta(h.momento)}, {hora(h.momento)}
            </span>
          </span>
          <p className="text-sm">{h.explicacion}</p>
        </div>
      ))}
      {pendiente ? (
        <>
          <PanelDecision
            idComentario="comentario-decision"
            refInterna={e.ref_interna}
            factura={e.factura_numero}
            beneficiario={e.beneficiario}
            montoUsd={e.monto_usd_centavos}
            // Agregar a la lista permitida cambia las reglas: solo `editar_reglas` (el servidor responde 403 si no).
            puedeAgregarALista={e.reglas_que_fallaron.includes("R3") && permisoPara(sesion, "editar_reglas").ok}
            motivoSinPermiso={permiso.ok ? undefined : permiso.motivo}
            requiereDobleAprobacion={f.requiere_doble_aprobacion}
            firmas={f.firmas}
            actual={actual}
          />
        </>
      ) : null}
      {!pendiente && humanas.length === 0 ? (
        <p className="text-sm text-texto-3">
          {SIN_DECISION[e.decision ?? ""] ?? "No requiere decisión."}
        </p>
      ) : null}
    </Tarjeta>
  );
}

export default async function TrazaPage({ params }: PageProps<"/facturas/[ref]">) {
  const { ref } = await params;
  const f = await obtenerFactura(ref);
  if (!f) notFound();
  const e = f.entrada;
  const doc = f.documento;
  const vence = f.extraccion?.fecha_vencimiento.valor;
  const pendiente = f.estado === "ESCALAR";

  return (
    <>
      <Link href="/#decisiones" className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-link hover:underline">
        <ArrowLeftIcon className="size-4" aria-hidden />
        Volver a la bandeja
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-sm font-semibold">{e.factura_numero ?? e.ref_interna}</span>
            <PildoraDecision decision={f.estado} />
            {pendiente ? <span className="text-[13px] text-escalada-foreground">pendiente de aprobación</span> : null}
            <span className="font-mono text-xs text-muted-foreground">{e.ref_interna}</span>
          </div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-balance sm:text-[32px]">
            {e.beneficiario ?? "Beneficiario sin leer"} · <Monto dinero={e.monto_original} />
          </h1>
          <p className="text-[13px] text-pretty text-muted-foreground">
            Recibida por {etiquetaCanal(e.canal)} el {fechaCorta(e.momento)} a las {hora(e.momento)}
            {doc ? (
              <>
                {" "}
                desde <span className="font-mono break-all">{doc.remitente.valor}</span>
              </>
            ) : null}
            {vence ? ` · vence el ${fechaCorta(vence)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {pendiente ? (
            <Boton variante="primaria" nativeButton={false} render={<a href="#decidir" />}>
              Decidir ahora
            </Boton>
          ) : null}
          <Boton variante="secundaria" nativeButton={false} render={<Link href={`/registro?q=${encodeURIComponent(e.factura_numero ?? e.ref_interna)}&entrada=${encodeURIComponent(e.id)}`} />}>
            Ver en el registro
          </Boton>
        </div>
      </header>

      <PorQue f={f} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <VisorDocumento f={f} />
          <LineaDeTiempo hitos={f.linea_tiempo} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <DatosExtraidos f={f} />
          <TrazaReglas f={f} />
          <DecisionHumana f={f} />
        </div>
      </div>
    </>
  );
}
