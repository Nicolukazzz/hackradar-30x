import { describe, expect, it } from "vitest";

import { diaMes, enBogota, fechaCorta, fechaHora, hora, mesAnio, porcentajeUi } from "@/app/_componentes/formato";

describe("formato de fechas y porcentajes en pantalla", () => {
  it("muestra la hora de Bogotá aunque el momento venga en UTC", () => {
    expect(hora("2026-10-16T09:14:02-05:00")).toBe("09:14");
    expect(hora("2026-10-16T14:14:02Z")).toBe("09:14");
    expect(hora("2026-10-17T03:30:00Z", true)).toBe("22:30:00");
    expect(diaMes("2026-10-17T03:30:00Z")).toBe("16 oct");
    expect(enBogota("2026-10-16")).toBe("2026-10-16");
  });

  it("textos de fecha", () => {
    expect(mesAnio("2026-10")).toBe("Octubre 2026");
    expect(fechaCorta("2026-10-16T09:24:00-05:00")).toBe("16 oct 2026");
    expect(fechaHora("2026-10-17T12:00:00-05:00")).toBe("17 oct, 12:00");
  });

  it("porcentaje sin signo, mismo redondeo half-up que dinero.ts", () => {
    expect(porcentajeUi(8 / 12)).toBe("66,7%");
    expect(porcentajeUi(0)).toBe("0,0%");
    expect(porcentajeUi(1)).toBe("100,0%");
  });
});
