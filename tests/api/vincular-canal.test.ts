// #110: proveedor conocido que escribe desde un correo o chat nuevo (R11): al aprobar, se puede vincular ese canal.

import { describe, expect, it, vi } from "vitest";

import { canalAVincular, decidir, ErrorDecision } from "@/aprobaciones/decidir";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import { obtenerAprobaciones } from "@/servicios/aprobaciones";
import { procesarPendientes } from "@/servicios/lote";

vi.mock("server-only", () => ({}));

const AHORA = "2026-11-16T15:00:00-05:00";

async function trampas() {
  const repo = await crearRepositorioMemoria("trampas-extra");
  await procesarPendientes(repo);
  const inv = (await repo.registro({ tipo: ["DECISION_AGENTE"] })).findLast((e) => e.factura_numero === "INV-2245")!;
  return { repo, inv };
}

describe("vincular canal al aprobar (#110)", () => {
  it("INV-2245 (CloudNorte desde otro correo, solo R11): se ofrece vincular ese correo", async () => {
    const { repo, inv } = await trampas();
    expect(inv.reglas_que_fallaron).toEqual(["R11"]);
    expect(canalAVincular(inv, await repo.documento(inv.ref_interna))).toEqual({ tipo: "correo", valor: "pagos-cloudnorte@gmail.example", beneficiario_id: "ben-cloudnorte" });
    const tarjeta = (await obtenerAprobaciones(repo)).pendientes.find((t) => t.ref_interna === inv.ref_interna)!;
    expect(tarjeta).toMatchObject({ puede_agregar_a_lista: false, canal_a_vincular: { tipo: "correo", valor: "pagos-cloudnorte@gmail.example" } });
    // Fuera de lista (R3) no se vincula: se agrega a la lista.
    const omi = (await obtenerAprobaciones(repo)).pendientes.filter((t) => t.reglas_que_fallaron.includes("R3"));
    expect(omi.every((t) => t.canal_a_vincular === null)).toBe(true);
  });

  it("al aprobar con vincular_canal el correo queda en CloudNorte y una entrada CAMBIO_BENEFICIARIOS lo explica", async () => {
    const { repo, inv } = await trampas();
    await decidir({ ref: inv.ref_interna, accion: "aprobar", comentario: "Confirmado por teléfono con CloudNorte", aprobador_id: "lm", vincular_canal: true }, { repo, ahora: AHORA });
    const cloud = (await repo.datosComunes()).beneficiarios.find((b) => b.id === "ben-cloudnorte")!;
    expect(cloud.canales.correos).toContain("pagos-cloudnorte@gmail.example");
    const cambio = (await repo.registro()).at(-1)!;
    expect(cambio).toMatchObject({ tipo: "CAMBIO_BENEFICIARIOS", beneficiario: "CloudNorte S.A.S." });
    expect(cambio.explicacion).toContain("vinculó el correo pagos-cloudnorte@gmail.example a CloudNorte S.A.S.");
  });

  it("no se vincula al rechazar, ni en una factura que no escaló por R11 (400)", async () => {
    const { repo, inv } = await trampas();
    await expect(decidir({ ref: inv.ref_interna, accion: "rechazar", comentario: "No reconozco el correo", aprobador_id: "lm", vincular_canal: true }, { repo, ahora: AHORA })).rejects.toBeInstanceOf(ErrorDecision);
    const otra = (await obtenerAprobaciones(repo)).pendientes.find((t) => !t.reglas_que_fallaron.includes("R11") && t.monto_usd_centavos !== null)!;
    await expect(
      decidir({ ref: otra.ref_interna, accion: "aprobar", comentario: "Vincula algo que no aplica", aprobador_id: "lm", vincular_canal: true }, { repo, ahora: AHORA }),
    ).rejects.toMatchObject({ estado: 400 });
  });
});
