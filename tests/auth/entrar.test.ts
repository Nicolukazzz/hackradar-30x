import { describe, expect, it } from "vitest";

import { respuestaEnvio } from "@/app/entrar/estado";

const correo = "laura@empresa.example";

describe("respuestaEnvio (paso 1 de /entrar)", () => {
  it("sin error pasa al paso del código", () => {
    expect(respuestaEnvio(null, correo)).toEqual({ paso: "codigo", correo });
  });

  it("correo no registrado (4xx) responde igual que uno registrado: sin enumeración", () => {
    expect(respuestaEnvio({ status: 422 }, correo)).toEqual({ paso: "codigo", correo });
    expect(respuestaEnvio({ status: 400 }, correo)).toEqual({ paso: "codigo", correo });
  });

  it("demasiados pedidos (429) se avisa", () => {
    expect(respuestaEnvio({ status: 429 }, correo)).toEqual({
      paso: "correo",
      error: "Pediste muchos códigos seguidos. Espera un minuto e inténtalo de nuevo.",
    });
  });

  it("falla del envío (5xx o sin status) se avisa en vez de esperar un código que no llegará", () => {
    const esperado = { paso: "correo", error: "No pudimos enviar el código. Inténtalo de nuevo en un minuto." };
    expect(respuestaEnvio({ status: 500 }, correo)).toEqual(esperado);
    expect(respuestaEnvio({ status: undefined }, correo)).toEqual(esperado);
  });
});
