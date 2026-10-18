import { DownloadIcon, ScrollTextIcon } from "lucide-react";
import Link from "next/link";

import { Boton, EncabezadoPagina } from "@/app/_componentes";
import { ConsultaRegistro, obtenerCriteriosExtraccion, obtenerRegistro } from "@/app/_datos/registro";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { relojSistema } from "@/lib/reloj-sistema";

import { FiltrosRegistro } from "../_registro/filtros";
import { ListaRegistro } from "../_registro/lista";

// Registro de decisiones (especificación §13.5, prototipo pantalla 5). Solo lectura: append-only (§9).

/** "Hoy" y "Ayer" en hora de la empresa (Bogotá), no la del servidor. */
function hoyYAyer() {
  const hoy = relojSistema().ahora().slice(0, 10);
  const ayer = new Date(Date.parse(`${hoy}T12:00:00Z`) - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { hoy, ayer };
}

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function RegistroPage({ searchParams }: PageProps<"/registro">) {
  const sp = await searchParams;
  // Mismo esquema que GET /api/registro: un valor desconocido en la URL se ignora (sin filtro).
  const { shape } = ConsultaRegistro;
  const decision = shape.decision.safeParse(texto(sp.decision) || undefined).data ?? "todas";
  const actor = shape.actor.safeParse(texto(sp.actor) || undefined).data;
  const q = shape.q.safeParse(texto(sp.q).slice(0, 100)).data ?? "";
  const [r, criterios] = await Promise.all([obtenerRegistro({ decision, actor, q }), obtenerCriteriosExtraccion()]);

  const { hoy, ayer } = hoyYAyer();
  const filtrado = decision !== "todas" || actor !== undefined || q !== "";

  return (
    <>
      <EncabezadoPagina
        titulo="Registro"
        descripcion="Todo lo que se decidió, quién lo decidió y por qué. Nada se borra ni se edita."
        acciones={
          <>
            <Boton variante="secundaria" nativeButton={false} render={<a href="/api/registro/export.json" download />}>
              <DownloadIcon aria-hidden />
              JSON
            </Boton>
            <Boton variante="primaria" nativeButton={false} render={<a href="/api/registro/export.csv" download />}>
              <DownloadIcon aria-hidden />
              Exportar CSV
            </Boton>
          </>
        }
      />

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
                ? "Cada decisión del agente y de las personas quedará aquí con su explicación."
                : `Prueba con otra búsqueda${q ? ` distinta de «${q}»` : ""} o quita los filtros.`}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        // key: al cambiar los filtros la selección vuelve a la primera entrada del resultado nuevo.
        <ListaRegistro key={`${decision}|${actor ?? ""}|${q}`} dias={r.dias} inicial={texto(sp.entrada) || null} hoy={hoy} ayer={ayer} criterios={criterios} estimados={r.estimados} />
      )}
    </>
  );
}
