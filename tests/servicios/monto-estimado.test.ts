import { describe, expect, it } from "vitest";

import type { EntradaRegistro } from "@/dominio/tipos";
import { crearRepositorioMemoria } from "@/repositorio/memoria";
import { montoEstimado } from "@/servicios/comun";

// #141: un total dudoso se muestra convertido a la moneda base, igual que los seguros (solo para mostrar).
describe("montoEstimado", () => {
  it("convierte el total dudoso a la moneda base y no toca los seguros", async () => {
    const repo = await crearRepositorioMemoria("lote-demo-oct");
    const [datos, reglas, registro] = await Promise.all([repo.datosComunes(), repo.reglasVigentes(), repo.registro()]);
    const segura = registro.find((e) => e.extraccion && e.monto_usd_centavos !== null && e.monto_original?.moneda === "COP");
    expect(segura).toBeDefined();
    expect(montoEstimado(segura!, datos, reglas)).toBeNull();

    // La misma factura con el total marcado como no confiable (R1): COP 8.400.000 / 4.200 = USD 2.000,00.
    const dudosa: EntradaRegistro = { ...segura!, monto_usd_centavos: null, monto_original: { centavos: 840000000, moneda: "COP" } };
    expect(montoEstimado(dudosa, datos, reglas)).toEqual({ centavos: 200000, moneda: "USD" });

    expect(montoEstimado({ ...dudosa, monto_original: null }, datos, reglas)).toBeNull();
  });
});
