import type { Metadata } from "next";

import { Tarjeta, TarjetaEncabezado, TarjetaPie } from "@/app/_componentes";
import { VolverAjustes } from "@/app/_componentes/ajustes";
import { exigirMiembro } from "@/app/_datos/sesion";
import { formatearTasa } from "@/dominio/dinero";
import type { Moneda } from "@/dominio/tipos";
import { permisoPara } from "@/lib/auth/permisos";
import { obtenerRepositorio } from "@/repositorio";

import { MonedaBase } from "./cambiar-moneda";

export const metadata: Metadata = { title: "Moneda y tasas · Ajustes" };

const NOMBRE: Partial<Record<Moneda, string>> = {
  USD: "dólar estadounidense",
  COP: "peso colombiano",
  MXN: "peso mexicano",
  BRL: "real brasileño",
  ARS: "peso argentino",
  CLP: "peso chileno",
  PEN: "sol peruano",
  EUR: "euro",
  BOB: "boliviano",
  CRC: "colón costarricense",
  ZAR: "rand sudafricano",
  USDC: "USD Coin",
};

// Ajustes → Moneda y tasas (#86): la moneda base (en la que están límites y presupuesto) y las tasas del día que usa
// el agente. La base se cambia en la misma tarjeta (#156): se elige de la lista y debajo aparecen la vista previa y la
// confirmación; todo se convierte con la tasa del día (solo administradores).
export default async function MonedaPage() {
  const sesion = await exigirMiembro();
  const repo = await obtenerRepositorio();
  const [empresa, vivas, datos] = await Promise.all([repo.empresa(), repo.tasasVigentes(), repo.datosComunes()]);
  const base = empresa.moneda_base;
  // Producción: tasas del día. Demo/local: la tabla fija más reciente del set de prueba.
  const tabla = vivas?.tabla ?? Object.values(datos.tasas).sort((a, b) => b.periodo.localeCompare(a.periodo))[0] ?? null;
  const filas = tabla ? (Object.keys(tabla.tasas) as Moneda[]).filter((m) => m !== base).sort((a, b) => a.localeCompare(b)) : [];
  let pie = "Tabla fija ficticia del set de prueba (sin datos de mercado). En producción se usan las tasas del día.";
  if (vivas?.estado === "hoy") pie = `Tasas de hoy (${vivas.fecha}), de ${vivas.fuente}. Cada decisión guarda la tasa que usó.`;
  if (vivas?.estado === "anterior") pie = `La fuente no respondió hoy: se usan las del ${vivas.fecha} (${vivas.fuente}).`;
  if (vivas?.estado === "ninguna") pie = "No hay tasas: la fuente no respondió y no hay una foto anterior. Las facturas en otras monedas esperan a una persona (R1).";

  return (
    <>
      <VolverAjustes />
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex max-w-[640px] flex-col gap-1.5">
          <h1 className="text-[32px] leading-tight font-semibold tracking-tight">Moneda y tasas</h1>
          <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">
            Límites, presupuesto y montos se comparan en la moneda base. Una factura en otra moneda se convierte con la tasa del día y la decisión guarda la
            tasa que usó.
          </p>
        </div>
      </header>

      <Tarjeta as="section" aria-labelledby="base" className="max-w-[680px]">
        <TarjetaEncabezado id="base" titulo="Moneda base" descripcion="En esta moneda están los límites, el presupuesto y los límites de aprobación." />
        <MonedaBase actual={base} nombres={NOMBRE} permiso={permisoPara(sesion, "administrar")} />
      </Tarjeta>

      <Tarjeta as="section" aria-labelledby="tasas" className="max-w-[680px]">
        <TarjetaEncabezado id="tasas" titulo={vivas ? "Tasas del día" : "Tasas fijas"} descripcion={`Cuánto vale 1 ${base} en cada moneda.`} />
        {tabla && filas.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-t border-subtle">
                <th scope="col" className="px-6 py-2 font-medium">
                  Moneda
                </th>
                <th scope="col" className="px-6 py-2 text-right font-medium">
                  1 {base} =
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((m) => (
                <tr key={m} className="border-t border-subtle">
                  <td className="px-6 py-2">
                    <span className="font-mono">{m}</span>
                    {NOMBRE[m] ? <span className="text-muted-foreground"> · {NOMBRE[m]}</span> : null}
                  </td>
                  <td className="px-6 py-2 text-right font-mono tabular-nums">{formatearTasa(m, tabla)?.slice(m.length + 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="border-t border-subtle px-6 py-5 text-sm text-muted-foreground">Sin tasas disponibles: solo se aceptan facturas en {base}.</p>
        )}
        <TarjetaPie>{pie}</TarjetaPie>
      </Tarjeta>
    </>
  );
}
