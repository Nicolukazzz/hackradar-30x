import { Interactive, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir } from "../animar";
import { Encabezado } from "../componentes/Encabezado";
import { Fondo } from "../componentes/Fondo";
import { TarjetaFactura, type DatosFactura } from "../componentes/TarjetaFactura";
import { color, type Estado } from "../tema";

// 4 · Tres veredictos (14 s): tres facturas del lote demo (§11.4), cada una con su decisión y la explicación del registro.
const casos: { factura: DatosFactura; estado: Estado; porque: string }[] = [
  {
    factura: { numero: "FAC-1041", proveedor: "Ana María Gómez", monto: "COP 8.400.000", detalle: "Contrato CT-AMG · cuenta •••• 3021" },
    estado: "pagada",
    porque: "Cuadra con el contrato, la cuenta es la registrada y está bajo el límite automático (USD 2.000 ≤ 3.000).",
  },
  {
    factura: { numero: "PX-77", proveedor: "Pixel & Co.", monto: "USD 2.600,00", detalle: "La orden OC-121 acordó USD 1.800,00" },
    estado: "frenada",
    porque: "Cobra 44,4 % más de lo acordado y la tolerancia es 2 %. No se paga.",
  },
  {
    factura: { numero: "LF-2026-10", proveedor: "Lucía Fernández", monto: "USD 4.500,00", detalle: "Entrega final de la app" },
    estado: "escalada",
    porque: "Supera el pago automático de USD 3.000: la decide Laura Méndez (CFO), con plazo.",
  },
];

const VeredictosInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Fondo>
      <Encabezado kicker="Tres veredictos" titulo="Cada factura, una decisión con su porqué." />
      <div style={{ position: "absolute", left: 140, right: 140, top: 390, display: "flex", gap: 50 }}>
        {casos.map((c, i) => {
          const llega = entrada(frame, fps, 0.8 * fps + i * 10, 30);
          const sello = entrada(frame, fps, (3 + i * 1.6) * fps, 18);
          const c2 = color[c.estado];
          return (
            <div key={c.factura.numero} style={{ ...subir(llega, 60), flex: 1, display: "flex", flexDirection: "column", gap: 28 }}>
              <TarjetaFactura factura={c.factura} estado={c.estado} sello={sello} ancho={510} />
              <div
                style={{
                  opacity: sello,
                  translate: `0px ${(1 - sello) * 16}px`,
                  borderLeft: `6px solid ${c2.punto}`,
                  paddingLeft: 22,
                  fontSize: 30,
                  lineHeight: 1.35,
                  color: color.tinta,
                }}
              >
                {c.porque}
              </div>
            </div>
          );
        })}
      </div>
    </Fondo>
  );
};

export const Veredictos = Interactive.create({ Component: VeredictosInner, layout: "absolute-fill" });
