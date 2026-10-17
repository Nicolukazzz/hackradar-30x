import { Skeleton } from "@/components/ui/skeleton";

/** Mientras carga "Tus facturas": la misma estructura de la página, sin saltos al llegar los datos. */
export default function CargandoPortal() {
  return (
    <div className="min-h-svh bg-background" aria-busy="true" aria-label="Cargando tus facturas">
      <div className="h-[77px] border-b border-border bg-card" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  );
}
