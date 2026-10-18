import { FileQuestionIcon } from "lucide-react";
import Link from "next/link";

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** No hay ninguna factura con esa ref interna. */
export default function FacturaNoEncontrada() {
  return (
    <Empty className="flex-none rounded-2xl border bg-card py-20">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestionIcon />
        </EmptyMedia>
        <EmptyTitle>No encontramos esa factura</EmptyTitle>
        <EmptyDescription>Puede que el lote aún no se haya procesado o que la referencia esté mal escrita.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/85">
          Volver a la bandeja
        </Link>
      </EmptyContent>
    </Empty>
  );
}
