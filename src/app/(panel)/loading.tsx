import { Skeleton } from "@/components/ui/skeleton";

// Mientras el servidor lee el repositorio (Supabase) de cualquier pantalla del panel.
export default function Cargando() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-4 w-[520px] max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-[14px]" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
