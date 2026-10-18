// Las pantallas nunca se caen por una factura rara (incidente 2026-10-18: una factura real en COP con centavos hizo
// que formatear() lanzara y Bandeja y Pendientes mostraran "No pudimos cargar esta pantalla" para todas).
// Se meten al registro decisiones con datos extremos (montos negativos o con centavos en COP, fechas de 2019 o
// basura, sin número, sin beneficiario, cualquier canal) y todos los servicios que arman pantallas deben responder.

import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import { formatear, formatearBase, formatearUsd } from "@/dominio/dinero";
import type { Canal, DecisionAgente, EntradaRegistro, Moneda } from "@/dominio/tipos";
import { obtenerAprobaciones } from "@/servicios/aprobaciones";
import { obtenerBandeja } from "@/servicios/bandeja";
import { obtenerFactura } from "@/servicios/facturas";
import { obtenerRegistro, registroACsv } from "@/servicios/registro";
import { novedades, porVerificar } from "@/servicios/verificar";

import { entradaDe, repoProcesado } from "../api/ayuda";

vi.mock("server-only", () => ({}));

const MONEDAS: Moneda[] = ["USD", "EUR", "COP", "BRL", "MXN", "ARS", "CLP", "PEN", "BOB", "CRC", "ZAR", "USDC"];
const CANALES: Canal[] = ["portal", "correo", "telegram", "whatsapp", "carga_manual"];
const DECISIONES: DecisionAgente[] = ["PAGAR", "FRENAR", "ESCALAR", "RECHAZADA_NO_FACTURA"];

const centavos = fc.oneof(fc.integer({ min: -1e12, max: 1e12 }), fc.constantFrom(0, 1, 31657796, 441176550, 99, Number.MAX_SAFE_INTEGER));
const fecha = fc.option(fc.constantFrom("2019-01-29", "2024-04-05", "2026-10-18", "2099-12-31", "", "basura", "2026-02-30"), { nil: null });
const momento = fc.constantFrom("2026-10-16T09:30:00-05:00", "2026-10-18T04:57:36.185Z", "2019-01-29T00:00:00-05:00", "2026-10-18");

const rara = fc.record({
  monto: fc.option(fc.record({ centavos, moneda: fc.constantFrom(...MONEDAS) }), { nil: null }),
  usd: fc.option(centavos, { nil: null }),
  decision: fc.constantFrom(...DECISIONES),
  canal: fc.constantFrom(...CANALES),
  vence: fecha,
  emision: fecha,
  numero: fc.option(fc.string({ maxLength: 40 }), { nil: null }),
  beneficiario: fc.option(fc.string({ maxLength: 60 }), { nil: null }),
  momento,
  moneda_base: fc.option(fc.constantFrom(...MONEDAS), { nil: undefined }),
});

describe("formatos de dinero nunca lanzan", () => {
  it("cualquier monto (negativo, enorme, con centavos en COP/CLP, no entero) en cualquier moneda", () => {
    fc.assert(
      fc.property(fc.oneof(centavos, fc.double()), fc.constantFrom(...MONEDAS), (c, m) => {
        expect(typeof formatear({ centavos: c, moneda: m })).toBe("string");
        expect(typeof formatearBase(c, m)).toBe("string");
        expect(typeof formatearUsd(c)).toBe("string");
      }),
      { numRuns: 2000 },
    );
  });
});

describe("las pantallas responden con cualquier factura en el registro", () => {
  it("Bandeja, Pendientes, Registro, traza, verificación y CSV no lanzan", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(rara, { minLength: 1, maxLength: 4 }), async (raras) => {
        const repo = await repoProcesado();
        const base = await entradaDe(repo, "LF-2026-10");
        const refs: string[] = [];
        for (const r of raras) {
          const ref = await repo.siguienteRef(2026);
          refs.push(ref);
          const e: EntradaRegistro = structuredClone(base);
          Object.assign(e, {
            id: await repo.siguienteIdRegistro(2026),
            ref_interna: ref,
            momento: r.momento,
            canal: r.canal,
            decision: r.decision,
            factura_numero: r.numero,
            beneficiario: r.beneficiario,
            monto_original: r.monto,
            monto_usd_centavos: r.usd,
            ...(r.moneda_base ? { moneda_base: r.moneda_base } : {}),
          });
          if (e.extraccion) {
            e.extraccion.fecha_vencimiento = { ...e.extraccion.fecha_vencimiento, valor: r.vence };
            e.extraccion.fecha_emision = { ...e.extraccion.fecha_emision, valor: r.emision };
            e.extraccion.monto_total = { ...e.extraccion.monto_total, valor: r.monto };
          }
          await repo.agregarEntrada(e);
        }
        await obtenerBandeja(repo);
        await obtenerBandeja(repo, { decision: "escalar", q: "a" });
        await obtenerAprobaciones(repo);
        await obtenerAprobaciones(repo, "monto");
        await obtenerRegistro(repo);
        registroACsv(await repo.registro());
        await porVerificar(repo);
        await novedades(repo);
        for (const ref of refs) await obtenerFactura(repo, ref);
      }),
      { numRuns: 40 },
    );
  }, 120_000);
});
