// Fuente pública sin llave (#86): https://open.er-api.com/v6/latest/{BASE} → { result, rates: { COP: 3182.77, … } }.
// Las tasas ya vienen como 1 base = X moneda, igual que TablaTasas.

import { MONEDAS, type Moneda } from "@/dominio/tipos";

import type { FuenteTasas } from "./tipos";

const URL_BASE = "https://open.er-api.com/v6/latest";
const TIEMPO_MAXIMO_MS = 10_000;
/** Cifras significativas: con base COP, 1 COP = 0,000314186… USD; con 6 decimales fijos se perdía el 0,06 %. */
const CIFRAS = 12;

/** Número de la API → decimal en texto sin notación científica ("3182.776456", "0.000314186390"). */
export function aTexto(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  const t = n.toPrecision(CIFRAS);
  const plano = t.includes("e") ? n.toFixed(20) : t;
  return plano.includes(".") ? plano.replace(/0+$/, "").replace(/\.$/, "") : plano;
}

export function crearFuenteErApi(f: typeof fetch = fetch): FuenteTasas {
  return {
    nombre: "open.er-api.com",
    async obtener(base) {
      const res = await f(`${URL_BASE}/${encodeURIComponent(base === "USDC" ? "USD" : base)}`, { signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
      if (!res.ok) throw new Error(`open.er-api.com respondió HTTP ${res.status}`);
      const cuerpo = (await res.json()) as { result?: string; rates?: Record<string, number> };
      if (cuerpo.result !== "success" || !cuerpo.rates) throw new Error("open.er-api.com no devolvió tasas");
      const tasas: Partial<Record<Moneda, string>> = {};
      for (const m of MONEDAS) {
        const valor = cuerpo.rates[m];
        const texto = typeof valor === "number" ? aTexto(valor) : null;
        if (texto) tasas[m] = texto;
      }
      // USDC no viene en la fuente: es una stablecoin atada 1:1 al dólar, así que vale lo mismo que USD.
      if (!tasas.USDC && tasas.USD) tasas.USDC = tasas.USD;
      if (base === "USDC") tasas.USD = "1";
      delete tasas[base];
      return { base, tasas, fuente: "open.er-api.com" };
    },
  };
}
