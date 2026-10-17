// Sin LLM: no aporta nada. Lo que el parser no encontró queda vacío y R1 escala.

import type { ProveedorLLM } from "./contrato";

export const ninguno: ProveedorLLM = {
  nombre: "ninguno",
  async extraer() {
    return { proveedor_llm: "ninguno" };
  },
};
