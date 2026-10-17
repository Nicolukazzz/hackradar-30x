import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as postReiniciar } from "@/app/api/demo/reiniciar/route";
import { decidir, ErrorDecision } from "@/aprobaciones/decidir";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import { procesarPendientes } from "@/servicios/lote";

import { comoProveedor, entradaDe, peticion, repoProcesado } from "./ayuda";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/sesion", async () => (await import("./ayuda")).sesionFalsa);
vi.mock("@/lib/auth/auditoria", () => ({ auditar: () => undefined }));

const AHORA = "2026-10-16T15:00:00-05:00";

describe("hallazgos de /code-review en #17", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("dos 'Procesar' a la vez (doble clic): 12 decisiones, ninguna duplicada ni perdida", async () => {
    const repo = await crearRepositorioMemoria("lote-demo-oct");
    const [a, b] = await Promise.all([procesarPendientes(repo), procesarPendientes(repo)]);
    expect(a.procesadas + b.procesadas).toBe(12);
    const agente = await repo.registro({ tipo: ["DECISION_AGENTE"] });
    const delLote = agente.filter((e) => e.id.startsWith("REG-2026-"));
    expect(delLote).toHaveLength(12);
    expect(new Set(delLote.map((e) => e.ref_interna)).size).toBe(12);
    expect(await repo.pendientes()).toHaveLength(0);
  });

  it("aprobar y rechazar la misma factura a la vez: una gana, la otra recibe 409", async () => {
    const repo = await repoProcesado();
    const f = await entradaDe(repo, "F-0101");
    const r = await Promise.allSettled([
      decidir({ ref: f.ref_interna, accion: "aprobar", comentario: "Cuenta confirmada por llamada", aprobador_id: "lm" }, { repo, ahora: AHORA }),
      decidir({ ref: f.ref_interna, accion: "rechazar", comentario: "Cambio de cuenta no confirmado", aprobador_id: "ap" }, { repo, ahora: AHORA }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const rechazo = r.find((x) => x.status === "rejected");
    expect((rechazo as PromiseRejectedResult).reason).toBeInstanceOf(ErrorDecision);
    expect(((rechazo as PromiseRejectedResult).reason as ErrorDecision).estado).toBe(409);
    expect((await repo.registro({ tipo: ["DECISION_HUMANA"], ref_interna: f.ref_interna }))).toHaveLength(1);
  });

  it("agregar a la lista un beneficiario que ya existe: 409 y NO se registra la aprobación", async () => {
    const repo = await repoProcesado();
    const td = await entradaDe(repo, "TD-001");
    await repo.guardarBeneficiario({ ...(await repo.datosComunes()).beneficiarios[0]!, id: "ben-tecnologias-delta-spa", nombre: "Tecnologías Delta SpA" });
    const largo = (await repo.registro()).length;
    await expect(
      decidir({ ref: td.ref_interna, accion: "aprobar", comentario: "Proveedor validado", aprobador_id: "lm", agregar_a_lista: true }, { repo, ahora: AHORA }),
    ).rejects.toMatchObject({ estado: 409 });
    expect(await repo.registro()).toHaveLength(largo);
  });

  it("en producción sin DEMO=1, 'reiniciar' no existe (404); con DEMO=1 sí, y siempre exige sesión del panel", async () => {
    await repoProcesado();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO", "");
    const reiniciar = () => postReiniciar(peticion("http://x/api/demo/reiniciar", { method: "POST" }));
    expect((await reiniciar()).status).toBe(404);
    vi.stubEnv("DEMO", "1");
    expect((await reiniciar()).status).toBe(200);
    comoProveedor("ben-pixel-co");
    expect((await reiniciar()).status).toBe(403);
  });
});
