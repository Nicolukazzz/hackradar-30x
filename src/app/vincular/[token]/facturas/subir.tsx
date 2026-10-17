"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Boton } from "@/app/_componentes";
import { SubirDocumento } from "@/components/subir-documento";

/** Subida del portal (#85): al terminar refresca «Tus facturas». */
export function SubirFacturas({ token }: { token: string }) {
  const router = useRouter();
  return <SubirDocumento url={`/api/vincular/${encodeURIComponent(token)}/facturas`} alTerminar={() => router.refresh()} />;
}

export function Salir({ token }: { token: string }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  return (
    <Boton
      variante="secundaria"
      disabled={ocupado}
      onClick={() =>
        iniciar(async () => {
          await fetch(`/api/vincular/${encodeURIComponent(token)}`, { method: "DELETE" }).catch(() => null);
          router.replace(`/vincular/${encodeURIComponent(token)}`);
        })
      }
    >
      <LogOutIcon aria-hidden />
      Salir
    </Boton>
  );
}
