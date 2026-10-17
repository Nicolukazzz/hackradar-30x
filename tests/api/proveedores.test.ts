import { describe, expect, it, vi } from "vitest";

import { PATCH } from "@/app/api/proveedores/[id]/route";
import { GET, POST } from "@/app/api/proveedores/route";
import { obtenerRepositorio } from "@/repositorio";

import { comoCuenta, comoSesion, peticion, repoProcesado } from "./ayuda";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/sesion", async () => (await import("./ayuda")).sesionFalsa);
vi.mock("@/lib/auth/auditoria", () => ({ auditar: () => undefined }));

const NUEVO = {
  nombre: "Estudio Nuevo S.A.S.",
  identificacion_fiscal: "900.123.456-7",
  pais: "CO",
  tipo: "proveedor",
  categoria: null,
  cuenta: { tipo: "cuenta", banco: "Banco Cafetal", ultimos4: "1234" },
  correos: ["Facturacion@EstudioNuevo.example"],
  limite_mensual_usd: 500000,
  acuerdo: { referencia: "OC-200", concepto: "Diseño de marca mensual", monto: { centavos: 120000, moneda: "USD" } },
  estado: "activo",
};
const crear = (body: unknown) => POST(peticion("http://x/api/proveedores", { method: "POST", body: JSON.stringify(body) }));
const editar = (id: string, body: unknown) => PATCH(peticion(`http://x/api/proveedores/${id}`, { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

describe("/api/proveedores (#107)", () => {
  it("admin crea: id legible, cuenta enmascarada, correo en minúsculas, acuerdo de una línea y CAMBIO_BENEFICIARIOS", async () => {
    const repo = await repoProcesado();
    const antes = (await repo.registro()).length;
    const res = await crear(NUEVO);
    expect(res.status).toBe(201);
    const b = await res.json();
    expect(b).toMatchObject({
      id: "ben-estudio-nuevo-s-a-s",
      identificacion_fiscal: "900.123.456-7",
      cuenta: { numero_enmascarado: "•••• 1234", ultimos4: "1234" },
      canales: { correos: ["facturacion@estudionuevo.example"], telegram_chat_id: null },
      acuerdo: { referencia: "OC-200", lineas: [{ codigo: "OC-200", monto: { centavos: 120000, moneda: "USD" } }] },
    });
    expect(b.acuerdo.lineas[0].palabras_clave).toEqual(expect.arrayContaining(["diseno", "marca"]));
    const registro = await (await obtenerRepositorio()).registro();
    expect(registro).toHaveLength(antes + 1);
    expect(registro.at(-1)).toMatchObject({ tipo: "CAMBIO_BENEFICIARIOS", ref_interna: "CONFIG-PROVEEDOR-ben-estudio-nuevo-s-a-s" });
    expect(registro.at(-1)!.explicacion).toContain("creó al proveedor Estudio Nuevo S.A.S. (900.123.456-7) con la cuenta •••• 1234");
    expect((await (await GET(peticion("http://x/api/proveedores"))).json()).proveedores.some((p: { id: string }) => p.id === b.id)).toBe(true);
  });

  it("no repite nombre, NIT ni correo de otro proveedor (409); datos inválidos 400; sin permiso 403", async () => {
    await repoProcesado();
    expect((await crear(NUEVO)).status).toBe(201);
    expect((await crear({ ...NUEVO, correos: [] })).status).toBe(409); // mismo nombre
    expect((await crear({ ...NUEVO, nombre: "Otro", identificacion_fiscal: "9001234567", correos: [] })).status).toBe(409); // mismo NIT con otro formato
    expect((await crear({ ...NUEVO, nombre: "Otro", identificacion_fiscal: null, correos: ["billing@cloudnorte.example"] })).status).toBe(409); // correo de CloudNorte
    expect((await crear({ ...NUEVO, nombre: "Otro", cuenta: { ...NUEVO.cuenta, ultimos4: "12" } })).status).toBe(400);
    comoCuenta("Teo", "tesoreria");
    expect((await crear({ ...NUEVO, nombre: "Otro más" })).status).toBe(403);
    comoSesion(null);
    expect((await crear(NUEVO)).status).toBe(401);
  });

  it("editar registra qué cambió; sin cambios no escribe; desactivar queda guardado (R3 exige activo)", async () => {
    const repo = await repoProcesado();
    const b = await (await crear(NUEVO)).json();
    const antes = (await repo.registro()).length;
    expect((await editar(b.id, NUEVO)).status).toBe(200);
    expect((await repo.registro()).length).toBe(antes);

    const res = await editar(b.id, { ...NUEVO, cuenta: { ...NUEVO.cuenta, ultimos4: "9999" }, estado: "inactivo" });
    expect(res.status).toBe(200);
    const ultima = (await repo.registro()).at(-1)!;
    expect(ultima.explicacion).toContain("cuenta •••• 1234 (Banco Cafetal) → •••• 9999 (Banco Cafetal)");
    expect(ultima.explicacion).toContain("desactivado");

    const inactivo = (await repo.datosComunes()).beneficiarios.find((x) => x.id === b.id)!;
    expect(inactivo.estado).toBe("inactivo");
    expect((await editar("ben-no-existe", NUEVO)).status).toBe(404);
  });
});
