// Sin LLM: no aporta nada. Lo que el parser no encontró queda vacío y R1 escala.

import type { ProveedorLLM } from "./contrato";

/** Lector vacío: se usa sin llaves (CI, desarrollo) y deja que R1 escale lo que el parser no encontró. */
export const ninguno: ProveedorLLM = {
  nombre: "ninguno",
  async extraer() {
    return { proveedor_llm: "ninguno" };
  },
};
