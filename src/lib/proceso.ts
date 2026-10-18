// Un error asíncrono sin capturar (webhook, sondeo de correo, after()) no debe matar el proceso: con Node por
// defecto, una promesa rechazada sin catch termina el servidor y la web entera se cae hasta que Railway lo reinicia.
// Se registra y el servidor sigue atendiendo; cada operación ya falla hacia seguro (escala, nunca paga).
// Solo Node: lo carga src/instrumentation.ts con import dinámico.

let instalado = false;

export function protegerProceso(): void {
  if (instalado) return;
  instalado = true;
  process.on("unhandledRejection", (e) => console.error("proceso: promesa rechazada sin capturar:", e instanceof Error ? (e.stack ?? e.message) : e));
  process.on("uncaughtException", (e) => console.error("proceso: excepción sin capturar:", e.stack ?? e.message));
}
