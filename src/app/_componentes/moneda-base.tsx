"use client";

import { createContext, useContext } from "react";

import type { Moneda } from "@/dominio/tipos";

// Moneda base de la empresa (#86) para los componentes de cliente del panel: límites, presupuesto y montos `*_usd`
// están en esta moneda. La pone el layout del panel; los componentes de servidor la reciben por props.
const Contexto = createContext<Moneda>("USD");

export function MonedaBaseProvider({ moneda, children }: { moneda: Moneda; children: React.ReactNode }) {
  return <Contexto value={moneda}>{children}</Contexto>;
}

export function useMonedaBase(): Moneda {
  return useContext(Contexto);
}
