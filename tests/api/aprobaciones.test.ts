import { describe, expect, it, vi } from "vitest";

import { POST as postDecision } from "@/app/api/aprobaciones/[ref]/route";
import { GET as getAprobaciones } from "@/app/api/aprobaciones/route";
import { decidir, ErrorDecision } from "@/aprobaciones/decidir";
import type { EntradaRegistro } from "@/dominio/tipos";
import { obtenerAprobaciones } from "@/servicios/aprobaciones";
import { obtenerBandeja } from "@/servicios/bandeja";

import { CUENTA, comoCuenta, comoSesion, entradaDe, escaladaSintetica, peticion, repoProcesado } from "./ayuda";


vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/sesion", async () => (await import("./ayuda")).sesionFalsa);
vi.mock("@/lib/auth/auditoria", () => ({ auditar: () => undefined }));

const AHORA = "2026-10-16T15:00:00-05:00";
const ctx = (ref: string) => ({ params: Promise.resolve({ ref }) }) as RouteContext<"/api/aprobaciones/[ref]">;
const post = (ref: string, body: unknown) =>
  postDecision(peticion(`http://x/api/aprobaciones/${ref}`, { method: "POST", body: JSON.stringify(body) }), ctx(ref));

async function falla(p: Promise<unknown>, estado: number, texto?: string) {
  const e = await p.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(ErrorDecision);
  expect((e as ErrorDecision).estado).toBe(estado);
  if (texto) expect((e as ErrorDecision).message).toContain(texto);
}

describe("GET /api/aprobaciones (§13.3)", () => {
  it("4 pendientes, F-0101 primero (vence hoy), reservado USD 9.278,65", async () => {
    await repoProcesado();
    const r = await (await getAprobaciones(peticion("http://x/api/aprobaciones"))).json();
    expect(r.pendientes.map((p: { factura_numero: string }) => p.factura_numero)).toEqual(["F-0101", "OMI-3381", "LF-2026-10", "TD-001"]);
    expect(r.reservado_usd).toBe(927865);
    expect(r.pendientes[1]).toMatchObject({ reglas_ok: 8, reglas_total: 11, puede_agregar_a_lista: true, asignacion: { aprobador: { id: "lm" } } });
    const porMonto = await (await getAprobaciones(peticion("http://x/api/aprobaciones?orden=monto"))).json();
    expect(porMonto.pendientes[0].factura_numero).toBe("LF-2026-10");
  });
});

describe("decidir() — reglas de §10", () => {
  it("aprobar LF-2026-10 (USD 4.500) como Andrés: permitido (≤ 5.000); pasa de reservado a pagado; nunca edita la del agente", async () => {
    const repo = await repoProcesado();
    const antes = await entradaDe(repo, "LF-2026-10");
    const largo = (await repo.registro()).length;
    const r = await decidir({ ref: antes.ref_interna, accion: "aprobar", comentario: "Hito final entregado y revisado.", aprobador_id: "ap" }, { repo, ahora: AHORA });
    expect(r.entrada).toMatchObject({ tipo: "DECISION_HUMANA", decision: "APROBADA_HUMANO", entrada_origen: antes.id, actor: { aprobador_id: "ap" } });
    expect(r.entrada.explicacion).toBe("Aprobada por Andrés Pardo: «Hito final entregado y revisado.».");
    expect(await repo.registro()).toHaveLength(largo + 1);
    expect(await entradaDe(repo, "LF-2026-10")).toEqual(antes);
    const b = await obtenerBandeja(repo);
    expect(b.presupuesto).toMatchObject({ pagado_en_lote: 744405 + 450000, reservado: 927865 - 450000, disponible: 227730 });
    expect(b.filas.find((f) => f.factura_numero === "LF-2026-10")?.estado).toBe("APROBADA_HUMANO");
    expect((await obtenerAprobaciones(repo)).pendientes).toHaveLength(3);
    // ya decidida: no se repite
    await falla(decidir({ ref: antes.ref_interna, accion: "rechazar", comentario: "Otra vez no", aprobador_id: "lm" }, { repo, ahora: AHORA }), 409, "ya fue aprobada");
  });

  it("ESCALAR de USD 6.000 como Andrés → 403; como Laura → aprobada", async () => {
    const repo = await repoProcesado();
    const ref = await escaladaSintetica(repo, 600000);
    await falla(decidir({ ref, accion: "aprobar", comentario: "Lo apruebo yo", aprobador_id: "ap" }, { repo, ahora: AHORA }), 403, "Supera tu límite");
    // rechazar nunca paga: no exige límite
    const lm = await decidir({ ref, accion: "aprobar", comentario: "Aprobado por dirección", aprobador_id: "lm" }, { repo, ahora: AHORA });
    expect(lm.entrada.decision).toBe("APROBADA_HUMANO");
  });

  it("comentario vacío o corto → 400; FRENAR (PX-77) → 409; ref inexistente → 404; aprobador desconocido → 403", async () => {
    const repo = await repoProcesado();
    const lf = await entradaDe(repo, "LF-2026-10");
    await falla(decidir({ ref: lf.ref_interna, accion: "aprobar", comentario: "   ok ", aprobador_id: "lm" }, { repo, ahora: AHORA }), 400, "comentario");
    const px = await entradaDe(repo, "PX-77");
    await falla(decidir({ ref: px.ref_interna, accion: "aprobar", comentario: "Págala igual", aprobador_id: "lm" }, { repo, ahora: AHORA }), 409, "frenada");
    await falla(decidir({ ref: "INT-2026-999999", accion: "aprobar", comentario: "No existe", aprobador_id: "lm" }, { repo, ahora: AHORA }), 404);
    await falla(decidir({ ref: lf.ref_interna, accion: "aprobar", comentario: "Soy otro", aprobador_id: "zz" }, { repo, ahora: AHORA }), 403);
  });

  it("doble aprobación ≥ USD 10.000: 1 de 2, la segunda de otra persona y al menos una con límite suficiente", async () => {
    const repo = await repoProcesado();
    const ref = await escaladaSintetica(repo, 1200000);
    // primera firma de control sin límite suficiente: permitida
    const p1 = await decidir({ ref, accion: "aprobar", comentario: "Primera firma de control", aprobador_id: "ap" }, { repo, ahora: AHORA });
    expect(p1).toMatchObject({ parcial: true, entrada: { decision: null } });
    expect(p1.entrada.explicacion).toContain("Primera aprobación (1 de 2) por Andrés Pardo");
    // sigue pendiente y reservada
    expect((await obtenerAprobaciones(repo)).pendientes.find((p) => p.ref_interna === ref)?.firmas).toHaveLength(1);
    await falla(decidir({ ref, accion: "aprobar", comentario: "Otra vez yo", aprobador_id: "ap" }, { repo, ahora: AHORA }), 409, "otra persona");
    const p2 = await decidir({ ref, accion: "aprobar", comentario: "Segunda firma CFO", aprobador_id: "lm" }, { repo, ahora: AHORA });
    expect(p2).toMatchObject({ parcial: false, entrada: { decision: "APROBADA_HUMANO" } });
  });

  it("agregar a la lista (TD-001, falló R3): crea el beneficiario con la cuenta y el canal de la factura y escribe CAMBIO_BENEFICIARIOS", async () => {
    const repo = await repoProcesado();
    const td = await entradaDe(repo, "TD-001");
    const r = await decidir({ ref: td.ref_interna, accion: "aprobar", comentario: "Proveedor validado por compras", aprobador_id: "lm", agregar_a_lista: true }, { repo, ahora: AHORA });
    expect(r.beneficiario_agregado).toMatchObject({ nombre: "Tecnologías Delta SpA", cuenta: { ultimos4: "3390" }, canales: { correos: ["ventas@tecnologiasdelta.example"] } });
    const cambios = await repo.registro({ tipo: ["CAMBIO_BENEFICIARIOS"] });
    expect(cambios).toHaveLength(1);
    expect(cambios[0]?.entrada_origen).toBe(r.entrada.id);
    // solo si falló R3
    const lf = await entradaDe(repo, "LF-2026-10");
    await falla(decidir({ ref: lf.ref_interna, accion: "aprobar", comentario: "Agrégala", aprobador_id: "lm", agregar_a_lista: true }, { repo, ahora: AHORA }), 400, "R3");
  });
});

describe("POST /api/aprobaciones/:ref (ruta)", () => {
  it("sin sesión → 401; aprobador_id en el body → 400 (la identidad sale de la sesión); comentario vacío → 400", async () => {
    const repo = await repoProcesado();
    const lf = await entradaDe(repo, "LF-2026-10");
    comoSesion(null);
    expect((await post(lf.ref_interna, { accion: "aprobar", comentario: "Hito final revisado" })).status).toBe(401);
    comoSesion(CUENTA);
    expect((await post(lf.ref_interna, { accion: "aprobar", comentario: "Hito final revisado", aprobador_id: "lm" })).status).toBe(400);
    expect((await post(lf.ref_interna, { accion: "aprobar", comentario: "" })).status).toBe(400);
  });

  it("#49: cualquier cuenta aprueba con su propio nombre → 201; errores con { error }", async () => {
    const repo = await repoProcesado();
    const lf = await entradaDe(repo, "LF-2026-10");
    const res = await post(lf.ref_interna, { accion: "aprobar", comentario: "Hito final entregado y revisado." });
    expect(res.status).toBe(201);
    const e = (await res.json()) as EntradaRegistro;
    expect(e).toMatchObject({ decision: "APROBADA_HUMANO", actor: { tipo: "humano", aprobador_id: CUENTA.usuario_id, nombre: "Ana Torres (ana@nebula.example)" } });
    const px = await entradaDe(repo, "PX-77");
    const r409 = await post(px.ref_interna, { accion: "aprobar", comentario: "Págala igual" });
    expect(r409.status).toBe(409);
    expect(await r409.json()).toHaveProperty("error");
  });

  it("#49: sobre USD 10.000 hacen falta dos cuentas distintas; la misma cuenta dos veces → 409", async () => {
    const repo = await repoProcesado();
    const ref = await escaladaSintetica(repo, 1_200_000);
    const primera = await post(ref, { accion: "aprobar", comentario: "Primera firma, revisado" });
    expect(primera.status).toBe(201);
    expect(((await primera.json()) as EntradaRegistro).decision).toBeNull();
    expect((await post(ref, { accion: "aprobar", comentario: "Otra vez yo" })).status).toBe(409);
    comoCuenta("Beto Ruiz");
    const segunda = await post(ref, { accion: "aprobar", comentario: "Segunda firma, de acuerdo" });
    expect(segunda.status).toBe(201);
    expect(((await segunda.json()) as EntradaRegistro)).toMatchObject({ decision: "APROBADA_HUMANO", actor: { nombre: "Beto Ruiz (beto-ruiz@nebula.example)" } });
  });
});
