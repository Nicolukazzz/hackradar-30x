import { describe, expect, it } from "vitest";

import { errorDeContrasena, mensajeDeError, respuestaEnvio } from "@/app/entrar/estado";

const correo = "ana@empresa.example";

describe("respuestaEnvio (código enviado al correo)", () => {
  it("sin error pasa al paso indicado", () => {
    expect(respuestaEnvio(null, { vista: "recuperar", correo })).toEqual({ vista: "recuperar", correo });
  });

  it("4xx responde igual que un envío correcto: no delata qué correos existen", () => {
    expect(respuestaEnvio({ status: 422 }, { vista: "recuperar", correo })).toEqual({ vista: "recuperar", correo });
  });

  it("429 se avisa en la misma vista", () => {
    expect(respuestaEnvio({ status: 429 }, { vista: "recuperar", correo }, "olvide")).toEqual({
      vista: "olvide",
      correo,
      error: "Pediste muchos códigos seguidos. Espera un minuto e inténtalo de nuevo.",
    });
  });

  it("5xx o sin status se avisa: el código no va a llegar", () => {
    const esperado = { vista: "olvide", correo, error: "No pudimos enviar el código. Inténtalo de nuevo en un minuto." };
    expect(respuestaEnvio({ status: 500 }, { vista: "recuperar", correo }, "olvide")).toEqual(esperado);
    expect(respuestaEnvio({ status: undefined }, { vista: "recuperar", correo }, "olvide")).toEqual(esperado);
  });
});

describe("mensajeDeError", () => {
  it("credenciales malas: mensaje genérico (no dice si el correo existe)", () => {
    expect(mensajeDeError({ code: "invalid_credentials", status: 400 })).toBe("Correo o contraseña incorrectos.");
  });

  it("código vencido o incorrecto", () => {
    expect(mensajeDeError({ code: "otp_expired", status: 403 })).toBe("Código incorrecto o vencido. Pide uno nuevo.");
  });

  it("contraseña débil", () => {
    expect(mensajeDeError({ code: "weak_password", status: 422 })).toBe("La contraseña es muy débil: usa al menos 8 caracteres.");
  });

  it("límite de intentos", () => {
    expect(mensajeDeError({ code: "over_request_rate_limit", status: 429 })).toBe("Demasiados intentos. Espera unos minutos.");
  });

  it("cualquier otro error: mensaje neutro", () => {
    expect(mensajeDeError({ code: "algo_raro", status: 500 })).toBe("No pudimos completar la acción. Inténtalo de nuevo.");
  });
});

describe("errorDeContrasena", () => {
  it("menos de 8 caracteres", () => {
    expect(errorDeContrasena("1234567")).toBe("La contraseña debe tener al menos 8 caracteres.");
  });

  it("más de 72 bytes (límite de bcrypt), contando tildes como 2", () => {
    const larga = "La contraseña es demasiado larga: usa hasta 72 caracteres sin tildes ni emojis.";
    expect(errorDeContrasena("a".repeat(73))).toBe(larga);
    expect(errorDeContrasena("ñ".repeat(40))).toBe(larga);
    expect(errorDeContrasena("ñ".repeat(36))).toBeNull();
  });

  it("válida", () => {
    expect(errorDeContrasena("una-clave-larga")).toBeNull();
  });
});
