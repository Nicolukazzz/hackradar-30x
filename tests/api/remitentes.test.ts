// API de remitentes por confirmar (2026-10-18): listar es del panel; responder (vincular un canal) es de administrador.

import { describe, expect, it, vi } from "vitest";

import { POST as postConfirmar } from "@/app/api/remitentes/confirmar/route";
import { GET as getRemitentes } from "@/app/api/remitentes/route";
import { fijarRepositorio } from "@/repositorio";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import { procesarPendientes } from "@/servicios/lote";

import { CUENTA, comoCuenta, comoSesion, peticion } from "./ayuda";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/sesion", async () => (await import("./ayuda")).sesionFalsa);
vi.mock("@/lib/auth/auditoria", () => ({ auditar: () => undefined }));

const GMAIL = { tipo: "correo", valor: "pagos-cloudnorte@gmail.example" };
const confirmar = (cuerpo: unknown) =>
  postConfirmar(peticion("http://x/api/remitentes/confirmar", { method: "POST", body: JSON.stringify(cuerpo), headers: { "content-type": "application/json" } }), {});

async function preparar() {
  const repo = await crearRepositorioMemoria("trampas-extra");
  await procesarPendientes(repo);
  fijarRepositorio(repo);
  comoSesion(CUENTA);
  return repo;
}

describe("/api/remitentes", () => {
  it("GET lista INV-2245; un aprobador no puede confirmar (403); el admin sí (201) y la factura se paga", async () => {
    await preparar();
    const lista = await (await getRemitentes(peticion("http://x/api/remitentes"), {})).json();
    expect(lista.remitentes).toHaveLength(1);
    comoCuenta("Andrea Paz", "aprobador", 500_000);
    expect((await confirmar({ remitente: GMAIL, beneficiario_id: "ben-cloudnorte", respuesta: "si" })).status).toBe(403);
    comoSesion(CUENTA);
    const r = await confirmar({ remitente: GMAIL, beneficiario_id: "ben-cloudnorte", respuesta: "si" });
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ respuesta: "si", pagadas: 1 });
  });

  it("body con quién decide → 400 (sale de la sesión); sin pendientes → 404", async () => {
    await preparar();
    expect((await confirmar({ remitente: GMAIL, beneficiario_id: "ben-cloudnorte", respuesta: "si", aprobador_id: "lm" })).status).toBe(400);
    expect((await confirmar({ remitente: GMAIL, beneficiario_id: "ben-mesa-legal", respuesta: "no" })).status).toBe(404);
  });
});
