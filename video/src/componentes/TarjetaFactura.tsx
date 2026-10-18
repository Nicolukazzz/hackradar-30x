import { color, fuente, fuenteMono, sombra, type Estado } from "../tema";
import { Pildora } from "./Pildora";

export type DatosFactura = { numero: string; proveedor: string; monto: string; detalle?: string };

/** Hoja de factura como la de la app: proveedor, número, total y (cuando ya se decidió) su píldora. */
export const TarjetaFactura: React.FC<{
  factura: DatosFactura;
  estado?: Estado | null;
  sello?: number;
  ancho?: number;
  style?: React.CSSProperties;
}> = ({ factura, estado = null, sello = 1, ancho = 460, style }) => (
  <div
    style={{
      width: ancho,
      backgroundColor: color.superficie,
      borderRadius: 24,
      boxShadow: sombra,
      border: `1px solid ${color.borde}`,
      fontFamily: fuente,
      color: color.tinta,
      overflow: "hidden",
      ...style,
    }}
  >
    <div style={{ padding: "28px 32px 22px", borderBottom: `2px dashed ${color.borde}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, letterSpacing: "0.08em", color: color.secundario, textTransform: "uppercase" }}>Factura</div>
        <div style={{ fontSize: 32, fontWeight: 600, marginTop: 6, whiteSpace: "nowrap" }}>{factura.proveedor}</div>
        <div style={{ fontFamily: fuenteMono, fontSize: 22, color: color.secundario, marginTop: 4 }}>{factura.numero}</div>
      </div>
      {estado ? <Pildora estado={estado} tamano={24} style={{ opacity: sello, scale: String(0.6 + 0.4 * sello) }} /> : null}
    </div>
    <div style={{ padding: "20px 32px 26px", display: "flex", flexDirection: "column", gap: 10 }}>
      {factura.detalle ? <div style={{ fontSize: 22, color: color.secundario }}>{factura.detalle}</div> : null}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 22, color: color.secundario }}>Total</span>
        <span style={{ fontFamily: fuenteMono, fontSize: 34, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{factura.monto}</span>
      </div>
    </div>
  </div>
);
