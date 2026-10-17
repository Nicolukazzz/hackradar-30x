"use client";

import { useRouter } from "next/navigation";

import { SubirDocumento } from "@/components/subir-documento";

/** Subida por el enlace de invitación (#28): al terminar refresca "Tus envíos". */
export function SubirPorEnlace({ token }: { token: string }) {
  const router = useRouter();
  return <SubirDocumento url={`/api/enviar/${encodeURIComponent(token)}`} alTerminar={() => router.refresh()} />;
}
