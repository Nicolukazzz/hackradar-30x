// Invitaciones de proveedor (#28): enlace con código único, siempre escala, y agregar a la lista vincula el correo.

import { readFile } from "node:fs/promises";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { decidir } from "@/aprobaciones/decidir";
import { dependenciasCanal } from "@/canales/dependencias";
import { remitenteInvitacion } from "@/dominio/remitente";
import { hashToken } from "@/equipo/token";
import { beneficiarioDelRemitente } from "@/ingesta/ingerir";
import type { AlmacenInvitaciones } from "@/invitaciones/almacen";
import { crearAlmacenInvitacionesMemoria } from "@/invitaciones/memoria";
import { correoDeInvitacion, estadoInvitacion } from "@/invitaciones/reglas";
import { crearInvitacion, enviarPorInvitacion, listarInvitaciones, misEnvios, revocarInvitacion, vistaInvitacion } from "@/invitaciones/servicio";
import { ErrorInvitacion } from "@/invitaciones/tipos";
import type { Sesion } from "@/lib/auth/permisos";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import type { Repositorio } from "@/repositorio/repositorio";

vi.stubEnv("LLM_PROVIDER", "ninguno");

const DOCS = "data/escenarios/lote-demo-oct/documentos";
const AHORA = "2026-10-16T10:00:00-05:00";
const ADMIN = { usuario_id: "00000000-0000-4000-8000-00000000000a" };
/** Proveedor nuevo: cuenta creada en /entrar, sin membresía en la empresa. */
const PROVEEDOR: Sesion = { usuario_id: "u-delta", correo: "ventas@tecnologiasdelta.example", nombre: "Delta", rol: null, limite_aprobacion_usd: null };

let almacen: AlmacenInvitaciones;
let repo: Repositorio;

beforeEach(async () => {
  almacen = crearAlmacenInvitacionesMemoria();
  repo = await crearRepositorioMemoria("lote-demo-oct", undefined, { lote: "vacio" });
});

const tokenDe = (enlace: string) => enlace.split("/enviar/")[1] ?? "";

async function enviar(token: string, archivo: string, sesion: Sesion = PROVEEDOR) {
  const deps = { ...(await dependenciasCanal(repo)), ahora: AHORA };
  return enviarPorInvitacion(almacen, token, sesion, { bytes: new Uint8Array(await readFile(`${DOCS}/${archivo}`)), nombre: archivo.split("/").at(-1)! }, deps);
}

describe("crear, ver y revocar (#28)", () => {
  it("el enlace lleva un token de 43 caracteres; en el almacén queda solo su hash", async () => {
    const { enlace, invitacion } = await crearInvitacion(almacen, ADMIN, { nombre_esperado: "Tecnologías Delta" }, AHORA);
    const token = tokenDe(enlace);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(invitacion).toMatchObject({ estado: "activa", usos_max: 5, usos: 0, nombre_esperado: "Tecnologías Delta", correo_esperado: null });
    expect(JSON.stringify(await almacen.listar())).not.toContain(token);
    expect(await almacen.porHash(hashToken(token))).not.toBeNull();
    expect(await vistaInvitacion(almacen, token, AHORA)).not.toBeNull();
  });

  it("valida la entrada: vigencia 1–30 días, usos 1–20, correo con formato", async () => {
    await expect(crearInvitacion(almacen, ADMIN, { dias_vigencia: 31 }, AHORA)).rejects.toBeInstanceOf(ErrorInvitacion);
    await expect(crearInvitacion(almacen, ADMIN, { usos_max: 0 }, AHORA)).rejects.toBeInstanceOf(ErrorInvitacion);
    await expect(crearInvitacion(almacen, ADMIN, { correo_esperado: "no-es-correo" }, AHORA)).rejects.toBeInstanceOf(ErrorInvitacion);
    await expect(crearInvitacion(almacen, ADMIN, { rol: "admin" }, AHORA)).rejects.toBeInstanceOf(ErrorInvitacion);
  });

  it("token con otro formato, vencido, revocado o agotado → no sirve, sin decir cuál", async () => {
    expect(await vistaInvitacion(almacen, "../../etc/passwd", AHORA)).toBeNull();
    const vencida = tokenDe((await crearInvitacion(almacen, ADMIN, { dias_vigencia: 1 }, AHORA)).enlace);
    expect(await vistaInvitacion(almacen, vencida, "2026-10-17T10:00:01-05:00")).toBeNull();

    const r = await crearInvitacion(almacen, ADMIN, {}, AHORA);
    await revocarInvitacion(almacen, r.invitacion.id, AHORA);
    expect(await vistaInvitacion(almacen, tokenDe(r.enlace), AHORA)).toBeNull();
    await expect(revocarInvitacion(almacen, r.invitacion.id, AHORA)).rejects.toMatchObject({ estado: 404 });
    await expect(enviar(tokenDe(r.enlace), "adjuntos/009-td-001.pdf")).rejects.toMatchObject({ estado: 404 });

    const una = await crearInvitacion(almacen, ADMIN, { usos_max: 1 }, AHORA);
    await enviar(tokenDe(una.enlace), "adjuntos/009-td-001.pdf");
    await expect(enviar(tokenDe(una.enlace), "adjuntos/002-inv-2210.pdf")).rejects.toMatchObject({ estado: 404 });
    const [ultima] = await listarInvitaciones(almacen, AHORA);
    expect(ultima).toMatchObject({ id: una.invitacion.id, usos: 1, estado: "agotada" });
  });

  it("con correo esperado, otra cuenta no puede enviar (y no gasta el uso)", async () => {
    const { enlace, invitacion } = await crearInvitacion(almacen, ADMIN, { correo_esperado: "Ventas@TecnologiasDelta.example" }, AHORA);
    const otra = { ...PROVEEDOR, usuario_id: "u-otra", correo: "otra@persona.example" };
    await expect(enviar(tokenDe(enlace), "adjuntos/009-td-001.pdf", otra)).rejects.toMatchObject({ estado: 403 });
    expect(estadoInvitacion((await almacen.porId(invitacion.id))!, AHORA)).toBe("activa");
    expect((await enviar(tokenDe(enlace), "adjuntos/009-td-001.pdf")).estado).toBe("en_revision");
  });

  it("un archivo inválido se rechaza antes de gastar un uso", async () => {
    const { enlace, invitacion } = await crearInvitacion(almacen, ADMIN, { usos_max: 1 }, AHORA);
    const deps = { ...(await dependenciasCanal(repo)), ahora: AHORA };
    const exe = { bytes: new Uint8Array(Buffer.from("MZ\x90\x00 programa", "latin1")), nombre: "factura.pdf" };
    await expect(enviarPorInvitacion(almacen, tokenDe(enlace), PROVEEDOR, exe, deps)).rejects.toMatchObject({ estado: 415 });
    expect((await almacen.porId(invitacion.id))?.usos).toBe(0);
  });
});

describe("lo que llega por invitación siempre escala (#28, §4.3 R11)", () => {
  it("proveedor nuevo (TD-001) → ESCALAR por R3 + R11; el proveedor ve «en revisión» sin reglas internas", async () => {
    const { enlace, invitacion } = await crearInvitacion(almacen, ADMIN, {}, AHORA);
    const envio = await enviar(tokenDe(enlace), "adjuntos/009-td-001.pdf");
    expect(envio).toMatchObject({ estado: "en_revision" });
    expect(envio.mensaje).not.toMatch(/R\d|límite|USD/);
    const [e] = await repo.registro({ ref_interna: envio.ref_interna, tipo: ["DECISION_AGENTE"] });
    expect(e).toMatchObject({ decision: "ESCALAR", canal: "portal" });
    expect(e?.reglas_que_fallaron).toEqual(["R3", "R11"]);
    expect(e?.explicacion).toContain("enlace de invitación, ventas@tecnologiasdelta.example");
    expect(e?.explicacion).not.toContain(invitacion.id);
    expect(await misEnvios(repo, invitacion.id, PROVEEDOR.correo)).toEqual([envio]);
    expect(await misEnvios(repo, invitacion.id, "otra@persona.example")).toEqual([]);
  });

  it("el mismo archivo dos veces frena por duplicado, pero al proveedor no se le confirma que ya existía (R11)", async () => {
    const { enlace } = await crearInvitacion(almacen, ADMIN, {}, AHORA);
    await enviar(tokenDe(enlace), "adjuntos/009-td-001.pdf");
    const segundo = await enviar(tokenDe(enlace), "adjuntos/009-td-001.pdf");
    const [e] = await repo.registro({ ref_interna: segundo.ref_interna, tipo: ["DECISION_AGENTE"] });
    expect(e?.decision).toBe("FRENAR");
    expect(segundo.estado).toBe("no_se_pagara");
    expect(segundo.mensaje).not.toMatch(/ya la hab|dos veces|repetid/i);
  });

  it("una factura «de CloudNorte» (en la lista) enviada por invitación escala por R11: cubre la suplantación", async () => {
    const { enlace } = await crearInvitacion(almacen, ADMIN, {}, AHORA);
    const envio = await enviar(tokenDe(enlace), "adjuntos/002-inv-2210.pdf");
    const [e] = await repo.registro({ ref_interna: envio.ref_interna, tipo: ["DECISION_AGENTE"] });
    expect(e?.decision).toBe("ESCALAR");
    expect(e?.reglas_que_fallaron).toEqual(["R11"]);
  });

  it("un remitente de invitación nunca se vincula a un beneficiario, aunque esté registrado como su canal", async () => {
    const valor = remitenteInvitacion("abc", "x@y.example");
    const { beneficiarios } = await repo.datosComunes();
    const trucados = beneficiarios.map((b) => ({ ...b, canales: { ...b.canales, portal_usuario: valor } }));
    expect(beneficiarioDelRemitente({ tipo: "portal", valor }, trucados)).toBeNull();
    expect(correoDeInvitacion(valor)).toBe("x@y.example");
    expect(correoDeInvitacion("ana@x.example")).toBeNull();
  });
});

describe("aprobar con «agregar a la lista» vincula el correo verificado (#28, §10)", () => {
  it("el beneficiario nuevo queda con el correo de quien envió; sus próximas facturas por correo pasan R11", async () => {
    const { enlace } = await crearInvitacion(almacen, ADMIN, {}, AHORA);
    const envio = await enviar(tokenDe(enlace), "adjuntos/009-td-001.pdf");
    const r = await decidir(
      { ref: envio.ref_interna, accion: "aprobar", comentario: "Proveedor nuevo validado por compras.", aprobador_id: "lm", agregar_a_lista: true },
      { repo, ahora: AHORA },
    );
    expect(r.beneficiario_agregado?.canales).toEqual({ correos: [PROVEEDOR.correo], telegram_chat_id: null, portal_usuario: null });
    const { beneficiarios } = await repo.datosComunes();
    expect(beneficiarioDelRemitente({ tipo: "correo", valor: PROVEEDOR.correo }, beneficiarios)).toBe(r.beneficiario_agregado?.id);
    // El enlace sigue sin verificar a nadie.
    expect(beneficiarioDelRemitente({ tipo: "portal", valor: remitenteInvitacion("x", PROVEEDOR.correo) }, beneficiarios)).toBeNull();
    expect((await misEnvios(repo, (await almacen.listar())[0]!.id, PROVEEDOR.correo))[0]?.estado).toBe("aprobada");
  });
});
