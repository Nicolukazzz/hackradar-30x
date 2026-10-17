import { describe, expect, it } from "vitest";

import { crearAlmacenEquipoMemoria } from "@/equipo/memoria";
import { EsquemaCambioMiembro, EsquemaNuevaInvitacion, estadoInvitacion, validarCambio, validarQuitar } from "@/equipo/reglas";
import { aceptar, cambiarMiembro, firmantes, invitar, obtenerEquipo, quitarMiembro, revocar, vistaInvitacion } from "@/equipo/servicio";
import { hashToken, pareceToken } from "@/equipo/token";
import { EMPRESA_ID, ErrorEquipo, type Invitacion, type Miembro } from "@/equipo/tipos";
import type { Sesion } from "@/lib/auth/permisos";

const AHORA = "2026-10-17T10:00:00-05:00";
const ADMIN: Sesion = { usuario_id: "u-admin", correo: "admin@nebula.example", nombre: "Admin", rol: "admin", limite_aprobacion_usd: null };
const cuenta = (id: string, correo = `${id}@correo.example`): Sesion => ({ usuario_id: id, correo, nombre: id, rol: null, limite_aprobacion_usd: null });

function preparar(ahora = AHORA) {
  const reloj = { actual: ahora, ahora() { return this.actual; } };
  const almacen = crearAlmacenEquipoMemoria(reloj);
  almacen.agregarCuenta({ usuario_id: ADMIN.usuario_id, nombre: "Admin", correo: ADMIN.correo });
  almacen.agregarMiembro(EMPRESA_ID, ADMIN.usuario_id, "admin");
  const nueva = (id: string, correo?: string) => {
    const c = cuenta(id, correo);
    almacen.agregarCuenta({ usuario_id: c.usuario_id, nombre: c.nombre, correo: c.correo });
    return c;
  };
  return { almacen, reloj, nueva };
}

const tokenDe = (enlace: string) => enlace.split("/unirse/")[1] ?? "";

async function falla(p: Promise<unknown>, estado: number, texto?: string) {
  const e = await p.then(() => null, (x: unknown) => x);
  expect(e).toBeInstanceOf(ErrorEquipo);
  expect((e as ErrorEquipo).estado).toBe(estado);
  if (texto) expect((e as ErrorEquipo).message).toContain(texto);
}

describe("esquemas", () => {
  it("límite solo para aprobador; correo obligatorio en minúsculas (#80); vigencia 3 días por defecto, máximo 30", () => {
    expect(EsquemaNuevaInvitacion.parse({ rol: "admin", limite_aprobacion_usd: 500000, correo_esperado: "a@b.example" })).toEqual({ rol: "admin", limite_aprobacion_usd: null, correo_esperado: "a@b.example", dias_vigencia: 3 });
    expect(EsquemaNuevaInvitacion.safeParse({ rol: "admin" }).success).toBe(false);
    expect(EsquemaNuevaInvitacion.safeParse({ rol: "admin", correo_esperado: "" }).success).toBe(false);
    expect(EsquemaNuevaInvitacion.parse({ rol: "aprobador", limite_aprobacion_usd: 500000, correo_esperado: " Ana@Correo.Example " })).toMatchObject({ limite_aprobacion_usd: 500000, correo_esperado: "ana@correo.example" });
    expect(EsquemaNuevaInvitacion.safeParse({ rol: "aprobador", dias_vigencia: 31 }).success).toBe(false);
    expect(EsquemaNuevaInvitacion.safeParse({ rol: "dueño" }).success).toBe(false);
    expect(EsquemaNuevaInvitacion.safeParse({ rol: "aprobador", limite_aprobacion_usd: 0 }).success).toBe(false);
    expect(EsquemaNuevaInvitacion.safeParse({ rol: "aprobador", limite_aprobacion_usd: 10.5 }).success).toBe(false);
    expect(EsquemaNuevaInvitacion.safeParse({ rol: "aprobador", empresa_id: "otra" }).success).toBe(false);
    expect(EsquemaCambioMiembro.parse({ rol: "tesoreria", limite_aprobacion_usd: 100 })).toEqual({ rol: "tesoreria", limite_aprobacion_usd: null });
  });
});

describe("estadoInvitacion", () => {
  const base: Invitacion = {
    id: "i", rol: "aprobador", limite_aprobacion_usd: null, correo_esperado: null, creada_por: null,
    creada_en: "2026-10-17T15:00:00.000Z", expira_en: "2026-10-24T15:00:00.000Z", usos_max: 1, usos: 0, revocada_en: null,
  };
  it("activa · vencida (en el instante exacto también) · usada · revocada", () => {
    expect(estadoInvitacion(base, AHORA)).toBe("activa");
    expect(estadoInvitacion(base, "2026-10-24T10:00:00-05:00")).toBe("vencida");
    expect(estadoInvitacion({ ...base, usos: 1 }, AHORA)).toBe("usada");
    expect(estadoInvitacion({ ...base, revocada_en: AHORA, usos: 1 }, AHORA)).toBe("revocada");
  });
});

describe("último admin", () => {
  const m = (usuario_id: string, rol: Miembro["rol"]): Miembro => ({ usuario_id, nombre: usuario_id, correo: "", rol, limite_aprobacion_usd: null, activo: true, desde: AHORA });
  it("no se puede quitar ni bajar de rol al único admin; con otro admin sí", () => {
    const solo = [m("a", "admin"), m("b", "aprobador")];
    expect(() => validarCambio(solo, "a", { rol: "aprobador", limite_aprobacion_usd: null })).toThrow("al menos un administrador");
    expect(() => validarQuitar(solo, "a")).toThrow("al menos un administrador");
    expect(validarCambio(solo, "b", { rol: "admin", limite_aprobacion_usd: null }).usuario_id).toBe("b");
    const dos = [...solo, m("c", "admin")];
    expect(validarQuitar(dos, "a").usuario_id).toBe("a");
    expect(() => validarQuitar(dos, "zz")).toThrow(ErrorEquipo);
  });
});

describe("invitaciones", () => {
  it("invitar → enlace con token; en el almacén solo queda el hash; aceptar crea la membresía con rol y límite", async () => {
    const { almacen, nueva } = preparar();
    const { invitacion, enlace } = await invitar(almacen, ADMIN, { rol: "aprobador", limite_aprobacion_usd: 500000, correo_esperado: "u-beto@correo.example" }, AHORA);
    const token = tokenDe(enlace);
    expect(pareceToken(token)).toBe(true);
    expect(invitacion).toMatchObject({ rol: "aprobador", limite_aprobacion_usd: 500000, usos_max: 1, usos: 0, estado: "activa", creada_por: "u-admin", expira_en: "2026-10-20T15:00:00.000Z" });
    expect(JSON.stringify(invitacion)).not.toContain(token);
    expect(await almacen.invitacionPorHash(EMPRESA_ID, hashToken(token))).toMatchObject({ id: invitacion.id });

    expect(await vistaInvitacion(almacen, token, AHORA)).toEqual({ rol: "aprobador", limite_aprobacion_usd: 500000, expira_en: invitacion.expira_en, correo_esperado: "u-beto@correo.example" });
    const beto = nueva("u-beto");
    expect(await aceptar(almacen, token, beto)).toBe("aceptada");
    const miembros = await almacen.miembros(EMPRESA_ID);
    expect(miembros.find((x) => x.usuario_id === "u-beto")).toMatchObject({ rol: "aprobador", limite_aprobacion_usd: 500000 });
    // un solo uso: con el mismo enlace nadie más entra, y la vista ya no la muestra
    expect(await aceptar(almacen, token, nueva("u-carla", "u-beto@correo.example"))).toBe("invalida");
    expect(await vistaInvitacion(almacen, token, AHORA)).toBeNull();
    expect((await obtenerEquipo(almacen, AHORA)).invitaciones[0]?.estado).toBe("usada");
  });

  it("ya miembro: no cambia su rol ni gasta el enlace", async () => {
    const { almacen } = preparar();
    const { enlace } = await invitar(almacen, ADMIN, { rol: "tesoreria", correo_esperado: ADMIN.correo }, AHORA);
    expect(await aceptar(almacen, tokenDe(enlace), ADMIN)).toBe("ya_miembro");
    expect((await almacen.miembros(EMPRESA_ID))[0]?.rol).toBe("admin");
    expect(await vistaInvitacion(almacen, tokenDe(enlace), AHORA)).not.toBeNull();
  });

  it("correo esperado: otra cuenta no la usa; la del correo (sin importar mayúsculas) sí", async () => {
    const { almacen, nueva } = preparar();
    const { enlace } = await invitar(almacen, ADMIN, { rol: "aprobador", correo_esperado: "laura@nebula.example" }, AHORA);
    expect(await aceptar(almacen, tokenDe(enlace), nueva("u-intruso", "intruso@correo.example"))).toBe("otro_correo");
    expect(await aceptar(almacen, tokenDe(enlace), nueva("u-laura", "Laura@Nebula.example"))).toBe("aceptada");
  });

  it("vencida o revocada → invalida (mismo resultado, no se dice cuál); token mal formado → invalida sin ir a la base", async () => {
    const { almacen, reloj, nueva } = preparar();
    const a = await invitar(almacen, ADMIN, { rol: "tesoreria", dias_vigencia: 1, correo_esperado: "u-2@correo.example" }, AHORA);
    const b = await invitar(almacen, ADMIN, { rol: "tesoreria", correo_esperado: "u-1@correo.example" }, AHORA);
    await revocar(almacen, b.invitacion.id, AHORA);
    await falla(revocar(almacen, b.invitacion.id, AHORA), 404);
    await falla(revocar(almacen, "no-es-uuid", AHORA), 404);
    expect(await aceptar(almacen, tokenDe(b.enlace), nueva("u-1"))).toBe("invalida");
    reloj.actual = "2026-10-18T10:00:00-05:00";
    expect(await vistaInvitacion(almacen, tokenDe(a.enlace), reloj.actual)).toBeNull();
    expect(await aceptar(almacen, tokenDe(a.enlace), nueva("u-2"))).toBe("invalida");
    expect(await aceptar(almacen, "../../etc", nueva("u-3"))).toBe("invalida");
    expect(await vistaInvitacion(almacen, "x".repeat(43) + "'", AHORA)).toBeNull();
    expect((await almacen.miembros(EMPRESA_ID)).map((m) => m.usuario_id)).toEqual(["u-admin"]);
  });
});

describe("miembros", () => {
  it("cambiar rol (con límite) y quitar; el último admin está protegido (409)", async () => {
    const { almacen, nueva } = preparar();
    const beto = nueva("u-beto");
    almacen.agregarMiembro(EMPRESA_ID, beto.usuario_id, "tesoreria");
    expect(await cambiarMiembro(almacen, "u-beto", { rol: "aprobador", limite_aprobacion_usd: 300000 }, AHORA)).toMatchObject({ rol: "aprobador", limite_aprobacion_usd: 300000 });
    await falla(cambiarMiembro(almacen, "u-admin", { rol: "aprobador" }, AHORA), 409, "al menos un administrador");
    await falla(quitarMiembro(almacen, "u-admin"), 409);
    await falla(cambiarMiembro(almacen, "u-beto", { rol: "superadmin" }, AHORA), 400);
    await falla(cambiarMiembro(almacen, "u-nadie", { rol: "admin" }, AHORA), 404);
    await cambiarMiembro(almacen, "u-beto", { rol: "admin" }, AHORA);
    await quitarMiembro(almacen, "u-admin");
    expect((await almacen.miembros(EMPRESA_ID)).map((m) => [m.usuario_id, m.rol])).toEqual([["u-beto", "admin"]]);
  });

  it("firmantes: solo admin y aprobador con cuenta activa", async () => {
    const { almacen, nueva } = preparar();
    nueva("u-t");
    almacen.agregarMiembro(EMPRESA_ID, "u-t", "tesoreria");
    almacen.agregarCuenta({ usuario_id: "u-off", nombre: "Off", correo: "off@x.example", activo: false });
    almacen.agregarMiembro(EMPRESA_ID, "u-off", "aprobador");
    expect(firmantes(await almacen.miembros(EMPRESA_ID)).map((m) => m.usuario_id)).toEqual(["u-admin"]);
  });
});
