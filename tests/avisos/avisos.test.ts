import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { armarAviso, destinatarios, limpiar } from "@/avisos/aviso";
import { crearAvisador, type DependenciasAvisador, escaparMarkdown } from "@/avisos/enviar";
import { avisarEscaladas, fijarAvisador } from "@/avisos";
import { cargarEscenario } from "@/dominio/cargar";
import type { Aprobador, DocumentoEntrante, EntradaRegistro } from "@/dominio/tipos";
import type { Miembro } from "@/equipo/tipos";
import { extractorGolden } from "@/ingesta/cargar-escenario";
import { ingerir } from "@/ingesta/ingerir";
import { procesarDocumento } from "@/ingesta/pipeline";
import { relojFijo } from "@/dominio/reloj";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import { procesarPendientes } from "@/servicios/lote";

const AHORA_LOTE = "2026-10-16T09:24:00-05:00";
/** `avisarEscaladas` corre en segundo plano: dejar que termine. */
const esperarAvisos = () => new Promise((r) => setTimeout(r, 0));
const enlace = (ref: string) => `https://panel.example/facturas/${ref}`;

let lote: EntradaRegistro[] = [];
let aprobadores: Aprobador[] = [];
const delLote = (numero: string) => {
  const e = lote.find((x) => x.factura_numero === numero);
  if (!e) throw new Error(`sin ${numero}`);
  return e;
};

beforeAll(async () => {
  fijarAvisador(null);
  const repo = await crearRepositorioMemoria("lote-demo-oct");
  const antes = (await repo.registro()).length;
  await procesarPendientes(repo);
  lote = (await repo.registro()).slice(antes);
  aprobadores = (await repo.datosComunes()).aprobadores;
});

afterEach(() => fijarAvisador(null));

const miembro = (usuario_id: string, rol: Miembro["rol"], extra: Partial<Miembro> = {}): Miembro => ({
  usuario_id,
  nombre: usuario_id,
  correo: `${usuario_id}@nebula.example`,
  rol,
  limite_aprobacion_usd: null,
  activo: true,
  desde: AHORA_LOTE,
  ...extra,
});

describe("armarAviso", () => {
  it("OMI-3381: dice quién, cuánto, por qué, a quién se asignó, para cuándo y dónde decidir", () => {
    const e = delLote("OMI-3381");
    const aviso = armarAviso(e, { aprobadores, decidido_en: AHORA_LOTE, enlace: enlace(e.ref_interna) });
    expect(aviso.asunto).toBe("Escalada: OMI-3381 · Servicios Ómicron S.A. · USD 2.980,00");
    expect(aviso.urgente).toBe(false);
    expect(aviso.texto).toContain(limpiar(e.explicacion, 600));
    expect(aviso.texto).toContain("omicron-pagos[.]example"); // el remitente que cita R11, sin enlace
    expect(aviso.texto).toContain("Laura Méndez (CFO)");
    expect(aviso.texto).toContain("17/10/2026 12:00");
    expect(aviso.texto).toContain("https://panel.example/facturas/INT-2026-000011");
    for (const c of e.comparaciones) expect(aviso.texto).toContain(limpiar(c, 160));
    expect(aviso.texto).toContain("El agente no pagó esta factura");
  });

  it("F-0101 vence pronto: plazo hoy 18:00 y asunto urgente", () => {
    const e = delLote("F-0101");
    const aviso = armarAviso(e, { aprobadores, decidido_en: AHORA_LOTE, enlace: enlace(e.ref_interna) });
    expect(aviso.urgente).toBe(true);
    expect(aviso.asunto.startsWith("Urgente · Escalada: F-0101")).toBe(true);
    expect(aviso.texto).toContain("16/10/2026 18:00");
  });

  it("sin número ni beneficiario legibles usa la ref y no escribe null", () => {
    const e: EntradaRegistro = { ...delLote("OMI-3381"), factura_numero: null, beneficiario: null, monto_usd_centavos: null };
    const aviso = armarAviso(e, { aprobadores, decidido_en: AHORA_LOTE, enlace: enlace(e.ref_interna) });
    expect(aviso.asunto).toBe("Escalada: INT-2026-000011 · beneficiario sin leer · monto por confirmar");
    expect(aviso.texto).not.toMatch(/null|undefined/);
  });
});

describe("texto que escribió quien cobra", () => {
  const malo: Partial<EntradaRegistro> = {
    beneficiario: "Ómicron [Aprobar aquí](https://pagos-malos.example/ok)\nAsignada a: CFO",
    factura_numero: "OMI-1\r\nBcc: x@y.example",
    explicacion: "Escalada: paga ya en www.pagos-malos.example\u202e",
  };

  it("sin saltos de línea ni controles, sin URL activas y con largo máximo", () => {
    expect(limpiar("a\nb\u0000c\u200bd")).toBe("a b c d");
    expect(limpiar("ver https://x.example y www.y.example")).toBe("ver https[:]//x[.]example y www.y[.]example");
    expect(limpiar("pagos-malos.example · mailto:a@b.co · javascript:alert(1)")).toBe("pagos-malos[.]example · mailto[:]a@b[.]co · javascript[:]alert(1)");
    // lo legítimo queda igual
    expect(limpiar("Servicios Ómicron S.A. · Ltda. · 4.500,00 > 3.000,00 USD · Escalada: hoy 18:00")).toBe("Servicios Ómicron S.A. · Ltda. · 4.500,00 > 3.000,00 USD · Escalada: hoy 18:00");
    expect(limpiar("x".repeat(50), 10)).toBe(`${"x".repeat(9)}…`);
  });

  it("el aviso no deja que la factura agregue líneas, enlaces ni cabeceras", () => {
    const e: EntradaRegistro = { ...delLote("OMI-3381"), ...malo };
    const aviso = armarAviso(e, { aprobadores, decidido_en: AHORA_LOTE, enlace: enlace(e.ref_interna) });
    expect(aviso.asunto).not.toMatch(/[\r\n]/);
    expect(aviso.texto).not.toContain("https://pagos-malos");
    expect(aviso.texto).not.toContain("pagos-malos.example");
    expect(aviso.texto).not.toContain("\nAsignada a: CFO");
    expect(aviso.texto.match(/https:\/\//g)).toHaveLength(1); // solo el enlace a la traza
  });

  it("Teams: Markdown escapado, un solo enlace real", () => {
    expect(escaparMarkdown("[a](b) **c** <d>")).toBe("\\[a\\]\\(b\\) \\*\\*c\\*\\* \\<d\\>");
  });
});

describe("destinatarios", () => {
  const admin = miembro("admin", "admin");
  const andres = miembro("andres", "aprobador", { limite_aprobacion_usd: 500000 });
  const sinLimite = miembro("sara", "aprobador");
  const teso = miembro("teso", "tesoreria");
  const inactivo = miembro("viejo", "aprobador", { activo: false });

  it("solo quien hoy puede aprobar ese monto; nunca tesorería ni cuentas inactivas", () => {
    const todos = [admin, andres, sinLimite, teso, inactivo];
    expect(destinatarios(todos, 400000).map((m) => m.usuario_id)).toEqual(["admin", "andres", "sara"]);
    expect(destinatarios(todos, 900000).map((m) => m.usuario_id)).toEqual(["admin", "sara"]);
  });

  it("sin monto confiable avisa a todos los firmantes", () => {
    expect(destinatarios([admin, andres, teso], null).map((m) => m.usuario_id)).toEqual(["admin", "andres"]);
  });

  it("si nadie cubre el monto, a los admins activos", () => {
    const soloLimitados = [andres, miembro("admin2", "admin", { activo: false })];
    expect(destinatarios(soloLimitados, 900000)).toEqual([]);
    expect(destinatarios([andres, admin], 900000).map((m) => m.usuario_id)).toEqual(["admin"]);
  });

  it("no repite un correo", () => {
    const doble = miembro("admin-b", "aprobador", { correo: "ADMIN@nebula.example" });
    expect(destinatarios([admin, doble], 100).map((m) => m.correo.toLowerCase())).toEqual(["admin@nebula.example"]);
  });
});

describe("crearAvisador", () => {
  function deps(extra: Partial<DependenciasAvisador> = {}) {
    const correos: { bcc: string[]; asunto: string; texto: string }[] = [];
    const posts: { url: string; cuerpo: unknown }[] = [];
    const d: DependenciasAvisador = {
      aprobadores: async () => aprobadores,
      miembros: async () => [miembro("admin", "admin"), miembro("andres", "aprobador", { limite_aprobacion_usd: 500000 }), miembro("teso", "tesoreria")],
      enlace,
      enviarCorreo: async (m) => {
        correos.push(m);
      },
      teams: {
        url: "https://teams.example/webhook",
        fetch: async (url, init) => {
          posts.push({ url: String(url), cuerpo: JSON.parse(String(init?.body)) });
          return new Response(null, { status: 202 });
        },
      },
      registrar: () => {},
      ...extra,
    };
    return { d, correos, posts };
  }

  it("PAGAR y FRENAR no avisan", async () => {
    const { d, correos, posts } = deps();
    const avisar = crearAvisador(d);
    await avisar(delLote("FAC-1041"), AHORA_LOTE);
    await avisar(delLote("PX-77"), AHORA_LOTE);
    expect(correos).toEqual([]);
    expect(posts).toEqual([]);
  });

  it("ESCALAR: un correo en copia oculta a quien puede aprobar y un mensaje a Teams", async () => {
    const { d, correos, posts } = deps();
    await crearAvisador(d)(delLote("OMI-3381"), AHORA_LOTE);
    expect(correos).toHaveLength(1);
    expect(correos[0]?.bcc).toEqual(["admin@nebula.example", "andres@nebula.example"]);
    expect(correos[0]?.asunto).toContain("OMI-3381");
    expect(posts).toEqual([{ url: "https://teams.example/webhook", cuerpo: { text: expect.stringContaining("OMI\\-3381") } }]);
    const text = (posts[0]?.cuerpo as { text: string }).text;
    expect(text.match(/\]\(https:/g)).toHaveLength(1);
    expect(text.endsWith("[Decidir en el panel](https://panel.example/facturas/INT-2026-000011)")).toBe(true);
  });

  it("si el correo falla, Teams igual sale y no lanza", async () => {
    const registrar = vi.fn();
    const { d, posts } = deps({
      enviarCorreo: async () => {
        throw new Error("smtp caído");
      },
      registrar,
    });
    await expect(crearAvisador(d)(delLote("LF-2026-10"), AHORA_LOTE)).resolves.toBeUndefined();
    expect(posts).toHaveLength(1);
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ canal: "correo", error: "smtp caído" }));
  });

  it("si no se pueden leer los miembros, no manda correo pero Teams sí", async () => {
    const { d, correos, posts } = deps({
      miembros: async () => {
        throw new Error("supabase caído");
      },
    });
    await crearAvisador(d)(delLote("TD-001"), AHORA_LOTE);
    expect(correos).toEqual([]);
    expect(posts).toHaveLength(1);
  });

  it("sin Teams configurado solo correo", async () => {
    const { d, correos } = deps({ teams: null });
    await crearAvisador(d)(delLote("TD-001"), AHORA_LOTE);
    expect(correos).toHaveLength(1);
  });
});

describe("avisarEscaladas en el pipeline", () => {
  it("la decisión queda registrada aunque el aviso falle, y solo se avisa lo escalado", async () => {
    const avisador = vi.fn(async () => {
      throw new Error("aviso roto");
    });
    fijarAvisador(avisador);
    const repo = await crearRepositorioMemoria("lote-demo-oct", undefined, { lote: "vacio" });
    const extractor = await extractorGolden("lote-demo-oct");
    const esc = await repo.escenario();
    const reloj = relojFijo(AHORA_LOTE);
    const metas = (await cargarEscenario("lote-demo-oct")).documentos;
    const decisiones: string[] = [];
    for (const archivo of ["001-fac-1041.pdf", "008-lf-2026-10.pdf"]) {
      const meta = metas.find((m) => m.archivo_original.endsWith(archivo));
      if (!meta) throw new Error(archivo);
      const entrada: DocumentoEntrante = { ...meta };
      delete (entrada as Partial<typeof meta>).archivo_original;
      const doc = await ingerir(entrada, { repo, reloj, dirBase: esc?.carpeta });
      const e = await procesarDocumento(doc.ref_interna, { repo, ahora: AHORA_LOTE, extractor });
      decisiones.push(e.decision ?? "");
      expect((await repo.registro({ ref_interna: doc.ref_interna })).length).toBe(1);
    }
    expect(decisiones).toEqual(["PAGAR", "ESCALAR"]);
    await esperarAvisos();
    expect(avisador).toHaveBeenCalledTimes(1);
  });

  it("sin avisador configurado no hace nada", () => {
    fijarAvisador(null);
    expect(() => avisarEscaladas([delLote("OMI-3381")])).not.toThrow();
  });

  it("Procesar facturas nuevas avisa las 4 escaladas del lote con la hora del lote", async () => {
    const avisador = vi.fn(async () => {});
    fijarAvisador(avisador);
    await procesarPendientes(await crearRepositorioMemoria("lote-demo-oct"));
    await esperarAvisos();
    expect(avisador).toHaveBeenCalledTimes(4);
    expect(avisador.mock.calls.map((c) => [(c as unknown[])[1]])).toEqual(Array(4).fill([AHORA_LOTE]));
  });
});
