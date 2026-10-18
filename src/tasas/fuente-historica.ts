// Fuente histórica gratis y sin llave (#86): currency-api (github.com/fawazahmed0/exchange-api), una foto diaria por
// fecha en jsDelivr: /npm/@fawazahmed0/currency-api@{AAAA-MM-DD}/v1/currencies/{base}.json → { date, usd: { cop: … } }.
// Si jsDelivr falla, el espejo de Cloudflare Pages. Las tasas ya vienen como 1 base = X moneda.

import { MONEDAS, type Moneda } from "@/dominio/tipos";

import { aTexto } from "./fuente-er-api";
import type { FuenteHistorica } from "./tipos";

const TIEMPO_MAXIMO_MS = 10_000;
const urls = (base: string, fecha: string) => [
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${fecha}/v1/currencies/${base}.json`,
  `https://${fecha}.currency-api.pages.dev/v1/currencies/${base}.json`,
];

/** Fuente de tasas de una fecha pasada (currency-api), con espejo si jsDelivr falla. */
export function crearFuenteHistorica(f: typeof fetch = fetch): FuenteHistorica {
  return {
    nombre: "currency-api",
    async obtenerEn(base, fecha) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error(`fecha inválida: ${fecha}`);
      const clave = base.toLowerCase();
      let ultimoError: unknown = null;
      for (const url of urls(clave, fecha)) {
        try {
          const res = await f(url, { signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
          if (!res.ok) throw new Error(`currency-api respondió HTTP ${res.status}`);
          const cuerpo = (await res.json()) as Record<string, unknown>;
          const tasasCrudas = cuerpo[clave] as Record<string, number> | undefined;
          if (!tasasCrudas || typeof tasasCrudas !== "object") throw new Error("currency-api no devolvió tasas");
          const tasas: Partial<Record<Moneda, string>> = {};
          for (const m of MONEDAS) {
            if (m === base) continue;
            const valor = tasasCrudas[m.toLowerCase()];
            const texto = typeof valor === "number" ? aTexto(valor) : null;
            if (texto) tasas[m] = texto;
          }
          return { base, tasas, fuente: "currency-api" };
        } catch (e) {
          ultimoError = e;
        }
      }
      throw ultimoError instanceof Error ? ultimoError : new Error("currency-api no respondió");
    },
  };
}
