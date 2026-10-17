"use client";

import { useRouter } from "next/navigation";

import { SubirDocumento } from "@/components/subir-documento";

/** Subida del portal: al terminar refresca "Tus facturas" para que aparezca la nueva con su ref. */
export function SubirYActualizar() {
  const router = useRouter();
  return <SubirDocumento alTerminar={() => router.refresh()} />;
}
