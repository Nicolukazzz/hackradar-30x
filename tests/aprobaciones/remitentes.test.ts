// Remitentes por confirmar (2026-10-18): «¿este remitente es de este proveedor?» aparte de aprobar facturas.
// Caso del dataset: INV-2245 de CloudNorte llegó desde pagos-cloudnorte@gmail.example (solo falla R11).

import { describe, expect, it, vi } from "vitest";

import { confirmarRemitente, remitentesPorConfirmar } from "@/aprobaciones/remitentes";
import type { Aprobador } from "@/dominio/tipos";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import { obtenerAprobaciones } from "@/servicios/aprobaciones";
import { obtenerBandeja } from "@/servicios/bandeja";
import { procesarPendientes } from "@/servicios/lote";

vi.mock("server-only", () => ({}));

const AHORA = "2026-11-16T11:00:00-05:00";
const LAURA: Aprobador = { id: "lm", nombre: "Laura Méndez", rol: "CFO", limite_usd: null, principal: true, iniciales: "LM" };
const GMAIL = { tipo: "correo" as const, valor: "pagos-cloudnorte@gmail.example" };

async function trampas() {
  const repo = await crearRepositorioMemoria("trampas-extra");
  await procesarPendientes(repo);
  return repo;
}

describe("remitentes por confirmar", () => {
  it("agrupa por remitente y proveedor: INV-2245 desde un Gmail que CloudNorte no tiene vinculado", async () => {
    const repo = await trampas();
    const lista = await remitentesPorConfirmar(repo);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      remitente: GMAIL,
      beneficiario_id: "ben-cloudnorte",
      beneficiario: "CloudNorte S.A.S.",
      total_usd_centavos: 124000,
      facturas: [{ factura_numero: "INV-2245", otras_reglas: [] }],
    });
  });

  it("Sí: vincula el correo y la factura se vuelve a evaluar y se paga sola (no es su propio duplicado ni reserva dos veces)", async () => {
    const repo = await trampas();
    const antes = await obtenerBandeja(repo);
    const r = await confirmarRemitente({ remitente: GMAIL, beneficiario_id: "ben-cloudnorte", respuesta: "si", aprobador: LAURA }, { repo, ahora: AHORA });
    expect(r).toMatchObject({ respuesta: "si", pagadas: 1, siguen_escaladas: 0, frenadas: 0 });
    const nueva = r.entradas[0]!;
    expect(nueva).toMatchObject({ tipo: "DECISION_AGENTE", decision: "PAGAR", factura_numero: "INV-2245", reglas_que_fallaron: [] });
    expect(nueva.explicacion).toContain("Reevaluada: Laura Méndez confirmó que el correo pagos-cloudnorte@gmail.example es de CloudNorte S.A.S.");
    expect(nueva.evaluaciones.find((e) => e.id === "R11")?.resultado).toBe("CUMPLE");

    const cloud = (await repo.datosComunes()).beneficiarios.find((b) => b.id === "ben-cloudnorte")!;
    expect(cloud.canales.correos).toContain("pagos-cloudnorte@gmail.example");
    expect(await repo.registro({ tipo: ["CAMBIO_BENEFICIARIOS"] })).toHaveLength(1);
    expect(await remitentesPorConfirmar(repo)).toEqual([]);

    // La Bandeja muestra la última decisión (una sola fila) y el presupuesto pasa de reservado a pagado.
    const despues = await obtenerBandeja(repo);
    expect(despues.filas.filter((f) => f.factura_numero === "INV-2245").map((f) => f.decision)).toEqual(["PAGAR"]);
    expect(despues.kpis.total).toBe(antes.kpis.total);
    expect(despues.presupuesto.reservado).toBe(antes.presupuesto.reservado - 124000);
    expect(despues.presupuesto.pagado_en_lote).toBe(antes.presupuesto.pagado_en_lote + 124000);
    expect((await obtenerAprobaciones(repo)).pendientes.map((p) => p.factura_numero)).not.toContain("INV-2245");
  });

  it("No: rechaza sus facturas pendientes y no vincula nada", async () => {
    const repo = await trampas();
    const r = await confirmarRemitente({ remitente: GMAIL, beneficiario_id: "ben-cloudnorte", respuesta: "no", aprobador: LAURA }, { repo, ahora: AHORA });
    expect(r).toMatchObject({ respuesta: "no", rechazadas: 1 });
    expect(r.entradas[0]).toMatchObject({ tipo: "DECISION_HUMANA", decision: "RECHAZADA_HUMANO" });
    expect(r.entradas[0]!.comentario).toContain("no es de CloudNorte S.A.S.");
    expect((await repo.datosComunes()).beneficiarios.find((b) => b.id === "ben-cloudnorte")!.canales.correos).not.toContain("pagos-cloudnorte@gmail.example");
    expect(await remitentesPorConfirmar(repo)).toEqual([]);
  });

  it("sin facturas pendientes de ese remitente → 404; el correo de otro proveedor → 409", async () => {
    const repo = await trampas();
    await expect(confirmarRemitente({ remitente: GMAIL, beneficiario_id: "ben-mesa-legal", respuesta: "si", aprobador: LAURA }, { repo, ahora: AHORA })).rejects.toMatchObject({ estado: 404 });
    const mesa = (await repo.datosComunes()).beneficiarios.find((b) => b.id === "ben-mesa-legal")!;
    await repo.actualizarBeneficiario({ ...mesa, canales: { ...mesa.canales, correos: [...mesa.canales.correos, GMAIL.valor] } });
    await expect(confirmarRemitente({ remitente: GMAIL, beneficiario_id: "ben-cloudnorte", respuesta: "si", aprobador: LAURA }, { repo, ahora: AHORA })).rejects.toMatchObject({ estado: 409 });
  });

  it("si otra regla también falla, tras confirmar sigue escalada por esa razón (nunca se paga por confirmar)", async () => {
    const repo = await trampas();
    const inv = (await repo.registro({ tipo: ["DECISION_AGENTE"] })).findLast((e) => e.factura_numero === "INV-2245")!;
    // Misma factura con monto sobre el límite automático: falla R9 además de R11.
    const ext = structuredClone(inv.extraccion!);
    ext.monto_total = { ...ext.monto_total, valor: { centavos: 450000, moneda: "USD" } };
    await repo.agregarEntrada({ ...inv, id: await repo.siguienteIdRegistro(2026), extraccion: ext, monto_usd_centavos: 450000, reglas_que_fallaron: ["R9", "R11"] });
    const r = await confirmarRemitente({ remitente: GMAIL, beneficiario_id: "ben-cloudnorte", respuesta: "si", aprobador: LAURA }, { repo, ahora: AHORA });
    expect(r.pagadas).toBe(0);
    expect(r.entradas[0]!.decision).not.toBe("PAGAR");
    expect(r.entradas[0]!.evaluaciones.find((e) => e.id === "R11")?.resultado).toBe("CUMPLE");
  });
});
