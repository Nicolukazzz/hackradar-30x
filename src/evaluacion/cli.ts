// Lógica del CLI de evaluación (especificación §14). `scripts/evaluar.ts` solo le pasa argv, la hora
// y la consola; así los tests corren el CLI completo (con un motor saboteado) sin abrir procesos.
//   npm run evaluar -- --escenario lote-demo-oct --extraccion golden
//   npm run evaluar -- --todos --extraccion golden [--sin-informe]

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import type { procesarLote } from "@/reglas/motor";

import { evaluarEscenario, listarEscenarios, type ModoExtraccion, type ReporteEvaluacion } from "./evaluar";
import { informeMarkdown, resumenConsola } from "./informe";

export type DependenciasCli = {
  /** hora local `AAAA-MM-DD-HHMM` para el nombre del informe (el dominio no lee el reloj) */
  marcaTiempo: string;
  escribir: (texto: string) => void;
  color?: boolean;
  /** carpeta de datos; por defecto `data` */
  dirDatos?: string;
  /** carpeta del informe; por defecto `docs/research` */
  dirInformes?: string;
  motor?: typeof procesarLote;
};

const USO = "Uso: npm run evaluar -- (--escenario <id> | --todos) [--extraccion golden|real] [--sin-informe]";

/** Devuelve el exit code: 1 si hay algún pago indebido (o error de uso), 0 si no. */
export async function ejecutarCli(argv: string[], deps: DependenciasCli): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      escenario: { type: "string" },
      todos: { type: "boolean", default: false },
      extraccion: { type: "string", default: "golden" },
      "sin-informe": { type: "boolean", default: false },
    },
  });
  const modo = values.extraccion;
  if (modo !== "golden" && modo !== "real") {
    deps.escribir(`--extraccion debe ser golden o real (llegó «${modo}»).\n${USO}`);
    return 1;
  }
  const ids = values.todos ? await listarEscenarios(deps.dirDatos) : values.escenario ? [values.escenario] : [];
  if (ids.length === 0) {
    deps.escribir(USO);
    return 1;
  }

  const reportes: ReporteEvaluacion[] = [];
  for (const id of ids) {
    const r = await evaluarEscenario(id, { extraccion: modo as ModoExtraccion, dir: deps.dirDatos, motor: deps.motor });
    reportes.push(r);
    deps.escribir(`${resumenConsola(r, deps.color)}\n`);
  }

  if (!values["sin-informe"]) {
    const dir = deps.dirInformes ?? path.join("docs", "research");
    const archivo = path.join(dir, `eval-${deps.marcaTiempo}.md`);
    await mkdir(dir, { recursive: true });
    await writeFile(archivo, informeMarkdown(reportes, deps.marcaTiempo), "utf8");
    deps.escribir(`Informe: ${archivo}`);
  }

  const indebidos = reportes.reduce((n, r) => n + r.pagos_indebidos, 0);
  if (indebidos > 0) deps.escribir(`FALLA CRÍTICA: ${indebidos} pago(s) indebido(s). Exit 1.`);
  return indebidos > 0 ? 1 : 0;
}
