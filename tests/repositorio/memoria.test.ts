import { describe } from "vitest";

import { crearRepositorioMemoria } from "@/repositorio/memoria";

import { contratoRepositorio } from "./contrato";

describe("contrato del repositorio: memoria", () => {
  contratoRepositorio(() => crearRepositorioMemoria("lote-demo-oct"), { persistente: false });
});
