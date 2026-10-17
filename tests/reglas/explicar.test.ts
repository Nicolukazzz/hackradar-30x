// Especificación §7 y §14 (explicabilidad): las 26 explicaciones de los dos escenarios.

import { beforeAll, describe, expect, it } from "vitest";

import { procesarLote } from "@/reglas/motor";

import { cargarGolden } from "./escenario";

type Fila = { numero: string | null; beneficiario: string | null; decision: string; usd: number | null; explicacion: string; observaciones: string[] };
const filas: Record<string, Fila[]> = {};

beforeAll(async () => {
  for (const id of ["lote-demo-oct", "trampas-extra"]) {
    const g = await cargarGolden(id);
    const l = procesarLote(g.docs, { datos: g.datos, reglas: g.reglas, historial: g.escenario.historial, ahora: g.escenario.config.ahora });
    filas[id] = l.entradas.map((e, i) => ({
      numero: e.factura_numero,
      beneficiario: e.beneficiario,
      decision: e.decision ?? "",
      usd: e.monto_usd_centavos,
      explicacion: e.explicacion,
      observaciones: l.resultados[i]!.observaciones,
    }));
  }
});

describe("explicaciones (§7)", () => {
  it("snapshot de las 26 explicaciones", () => {
    expect(filas).toMatchSnapshot();
  });

  it("textos clave del prototipo", () => {
    const porNumero = (n: string, i = 0) => filas["lote-demo-oct"]!.filter((f) => f.numero === n)[i]!.explicacion;
    expect(porNumero("ES-4410")).toContain(
      "Frenada: el pago (USD 4.000,00) supera el presupuesto disponible de USD 2.277,30, que ya descuenta lo reservado por escalados.",
    );
    expect(porNumero("INV-2210", 1)).toBe("Frenada: CloudNorte S.A.S. ya cobró la factura INV-2210 y se pagó a las 09:14:10. No se paga dos veces.");
    expect(porNumero("PX-77")).toBe("Frenada: Pixel & Co. cobra USD 2.600,00, pero OC-121 acordó USD 1.800,00 (+44,4%; la tolerancia es 2%).");
    expect(porNumero("F-0101")).toBe(
      "Escalada: la cuenta de la factura (•••• 9083) no es la registrada para Diego Herrera (•••• 4471). Se reservan USD 648,65 del presupuesto mientras una persona decide.",
    );
    expect(porNumero("OMI-3381")).toMatch(/^Escalada: Servicios Ómicron S\.A\. no está en la lista.*Además, el correo traía instrucciones.*Además, el remitente/);
  });

  it("cada explicación nombra al beneficiario, trae un número si hay monto y no tiene jerga", () => {
    for (const f of [...filas["lote-demo-oct"]!, ...filas["trampas-extra"]!]) {
      if (f.decision === "RECHAZADA_NO_FACTURA") continue;
      expect(f.explicacion).toContain(f.beneficiario!.replace(/\.$/, ""));
      if (f.usd !== null) expect(f.explicacion).toMatch(/\d/);
      expect(f.explicacion).not.toMatch(/\b(null|undefined|true|false|NaN)\b|R\d+:|\.\.(\s|$)/);
      expect(f.explicacion).toMatch(/^(Pagada|Frenada|Escalada): /);
    }
  });
});
