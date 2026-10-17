import { DownloadIcon, ScrollTextIcon } from "lucide-react";
import Link from "next/link";

import { Boton } from "@/app/_componentes";
import { obtenerRegistro, type FiltroDecisionRegistro } from "@/app/_datos/registro";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { relojSistema } from "@/lib/reloj-sistema";

import { FiltrosRegistro } from "../_registro/filtros";
import { ListaRegistro } from "../_registro/lista";

// Registro de decisiones (especificación §13.5, prototipo pantalla 5). Solo lectura: append-only (§9).

const DECISIONES: readonly FiltroDecisionRegistro[] = ["todas", "pagar", "frenar", "escalar", "humanas"];
const ACTORES = ["agente", "humano"] as const;

/** "Hoy" y "Ayer" en hora de la empresa (Bogotá), no la del servidor. */
function hoyYAyer() {
  const hoy = relojSistema().ahora().slice(0, 10);
  const ayer = new Date(Date.parse(`${hoy}T12:00:00Z`) - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { hoy, ayer };
}

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function RegistroPage({ searchParams }: PageProps<"/registro">) {
  const sp = await searchParams;
  const decisionPedida = texto(sp.decision);
  const decision = (DECISIONES as readonly string[]).includes(decisionPedida) ? (decisionPedida as FiltroDecisionRegistro) : "todas";
  const actorPedido = texto(sp.actor);
  const actor = (ACTORES as readonly string[]).includes(actorPedido) ? (actorPedido as (typeof ACTORES)[number]) : undefined;
  const q = texto(sp.q).slice(0, 100);
  const r = await obtenerRegistro({ decision, actor, q });

  const { hoy, ayer } = hoyYAyer();
  const filtrado = decision !== "todas" || actor !== undefined || q !== "";

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex max-w-[700px] flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground">
            Solo se agrega, nunca se edita · {r.total} {r.total === 1 ? "entrada" : "entradas"}
          </span>
          <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-balance">Registro de decisiones</h1>
          <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">
            Cada entrada dice qué se decidió, quién lo decidió, qué reglas se evaluaron y con qué valores. Cualquiera puede entender un pago sin abrir
            el código.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Boton variante="secundaria" nativeButton={false} render={<a href="/api/registro/export.json" download />}>
            <DownloadIcon aria-hidden />
            Exportar JSON
          </Boton>
          <Boton variante="primaria" nativeButton={false} render={<a href="/api/registro/export.csv" download />}>
            <DownloadIcon aria-hidden />
            Exportar CSV para conciliar
          </Boton>
        </div>
      </header>

      <FiltrosRegistro q={q} decision={decision} actor={actor ?? "todos"} />

      {filtrado ? (
        <p className="-mt-2 text-[13px] text-muted-foreground" aria-live="polite">
          Mostrando {r.total_filtrado} de {r.total}.{" "}
          <Link href="/registro" scroll={false} className="font-medium text-link hover:underline">
            Quitar filtros
          </Link>
        </p>
      ) : null}

      {r.total_filtrado === 0 ? (
        <Empty className="flex-none rounded-2xl border bg-card py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScrollTextIcon />
            </EmptyMedia>
            <EmptyTitle>{r.total === 0 ? "El registro está vacío" : "Ninguna entrada coincide"}</EmptyTitle>
            <EmptyDescription>
              {r.total === 0
                ? "Cada decisión del agente y de las personas quedará aquí con su explicación. Usa Procesar facturas nuevas en la Bandeja."
                : `Prueba con otra búsqueda${q ? ` distinta de «${q}»` : ""} o quita los filtros.`}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        // key: al cambiar los filtros la selección vuelve a la primera entrada del resultado nuevo.
        <ListaRegistro key={`${decision}|${actor ?? ""}|${q}`} dias={r.dias} inicial={texto(sp.entrada) || null} hoy={hoy} ayer={ayer} />
      )}
    </>
  );
}
