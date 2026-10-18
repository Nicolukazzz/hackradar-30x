"use client";

import { createContext, useContext, useMemo, useState } from "react";

import type { CampoCorregible, Correcciones } from "@/aprobaciones/correcciones";

// Correcciones de la persona en la traza (#129): la tabla «Datos extraídos» las escribe (lápiz) y el panel «Decisión
// humana» las manda con la aprobación o el rechazo. Viven solo en esta pantalla hasta decidir; el registro las guarda
// con la decisión.

type Contexto = {
  correcciones: Correcciones;
  /** undefined = deshacer la corrección de ese campo */
  fijar: <K extends CampoCorregible>(campo: K, valor: Correcciones[K] | undefined) => void;
  limpiar: () => void;
  /** se puede corregir: la factura espera una decisión y la cuenta puede aprobar */
  editable: boolean;
};

const Ctx = createContext<Contexto>({ correcciones: {}, fijar: () => {}, limpiar: () => {}, editable: false });

export function CorreccionesProvider({ editable, children }: Readonly<{ editable: boolean; children: React.ReactNode }>) {
  const [correcciones, setCorrecciones] = useState<Correcciones>({});
  const valor = useMemo<Contexto>(
    () => ({
      correcciones,
      editable,
      limpiar: () => setCorrecciones({}),
      fijar: (campo, v) =>
        setCorrecciones((c) => {
          const nueva = { ...c };
          if (v === undefined) delete nueva[campo];
          else nueva[campo] = v;
          return nueva;
        }),
    }),
    [correcciones, editable],
  );
  return <Ctx value={valor}>{children}</Ctx>;
}

export function useCorrecciones(): Contexto {
  return useContext(Ctx);
}
