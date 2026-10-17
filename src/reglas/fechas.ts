// Aritmética de fechas sin reloj: todo parte de strings YYYY-MM-DD o de `ahora` inyectado.

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const DIA_MS = 86_400_000;

/** Milisegundos UTC de una fecha YYYY-MM-DD válida; null si no es una fecha real (ej. 2026-02-30). */
export function msDeFecha(fecha: string): number | null {
  const m = FECHA.exec(fecha);
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(anio, mes - 1, dia);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return ms;
}

export function esFechaValida(fecha: string): boolean {
  return msDeFecha(fecha) !== null;
}

/** Días absolutos entre dos fechas válidas. */
export function diasEntre(a: string, b: string): number {
  const ma = msDeFecha(a);
  const mb = msDeFecha(b);
  if (ma === null || mb === null) throw new RangeError(`fecha inválida: ${a} / ${b}`);
  return Math.abs(Math.round((ma - mb) / DIA_MS));
}

/** "2026-10-21" − 3 → "2026-10-18" */
export function sumarDias(fecha: string, dias: number): string {
  const ms = msDeFecha(fecha);
  if (ms === null) throw new RangeError(`fecha inválida: ${fecha}`);
  return new Date(ms + dias * DIA_MS).toISOString().slice(0, 10);
}

/** Fecha local de un momento ISO con zona: "2026-10-16T09:24:00-05:00" → "2026-10-16". */
export function fechaDe(momento: string): string {
  return momento.slice(0, 10);
}

/** Hora local de un momento ISO: "2026-10-16T09:14:10-05:00" → "09:14:10". */
export function horaDe(momento: string): string {
  return momento.slice(11, 19);
}

/** Zona de un momento ISO: "-05:00" (o "Z"). */
export function zonaDe(momento: string): string {
  return /([+-]\d{2}:\d{2}|Z)$/.exec(momento)?.[1] ?? "Z";
}

/** "2026-12-02" → "02/12/2026" */
export function fechaLegible(fecha: string): string {
  const m = FECHA.exec(fecha);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fecha;
}
