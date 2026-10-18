"use client";

import { UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Boton } from "@/app/_componentes";
import { SubirDocumento } from "@/components/subir-documento";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// «Cargar factura manualmente» (#119, antes «Recibir factura»): una persona del equipo sube el PDF o la foto de una
// factura que le llegó por fuera de los canales. Pasa por la misma ingesta y las mismas reglas (carga manual, #26).

export function CargarFactura() {
  const router = useRouter();
  return (
    <Sheet>
      <SheetTrigger render={<Boton variante="primaria" />}>
        <UploadIcon aria-hidden />
        Cargar factura manualmente
      </SheetTrigger>
      <SheetContent className="w-full gap-5 overflow-y-auto p-6 sm:max-w-md">
        <SheetHeader className="p-0">
          <SheetTitle className="text-lg">Cargar factura</SheetTitle>
          <SheetDescription>Sube el PDF o una foto. El agente la revisa con las mismas reglas que todo lo demás.</SheetDescription>
        </SheetHeader>
        <SubirDocumento alTerminar={() => router.refresh()} />
        <p className="text-xs leading-relaxed text-muted-foreground">Llega a tu nombre: si no eres el proveedor que cobra, una persona la aprueba antes de pagar.</p>
      </SheetContent>
    </Sheet>
  );
}
