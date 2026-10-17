// CLI de evaluación (especificación §14). La lógica vive en src/evaluacion/cli.ts.
//   npm run evaluar -- --escenario lote-demo-oct --extraccion golden
//   npm run evaluar -- --todos --extraccion golden
// Exit 1 si algún escenario aprueba un pago indebido (lo usa el CI).

import { ejecutarCli } from "@/evaluacion/cli";

function marcaTiempo(d: Date): string {
  const dos = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}`;
}

ejecutarCli(process.argv.slice(2), {
  marcaTiempo: marcaTiempo(new Date()),
  escribir: (texto) => console.log(texto),
  color: process.stdout.isTTY,
})
  // exitCode y no exit(): en macOS stdout por tubería es asíncrono y exit() corta las últimas líneas.
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
