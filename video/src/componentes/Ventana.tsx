import { color, sombra } from "../tema";

/** Marco de ventana (barra con tres puntos) para grabaciones y capturas. */
export const Ventana: React.FC<{ ancho: number; alto: number; children: React.ReactNode; style?: React.CSSProperties; titulo?: string }> = ({ ancho, alto, children, style, titulo }) => (
  <div style={{ width: ancho, borderRadius: 20, overflow: "hidden", boxShadow: sombra, border: `1px solid ${color.bordeFuerte}`, backgroundColor: color.superficie, ...style }}>
    <div style={{ height: 40, display: "flex", alignItems: "center", gap: 9, paddingLeft: 18, backgroundColor: color.sutil, borderBottom: `1px solid ${color.borde}` }}>
      {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
        <span key={c} style={{ width: 13, height: 13, borderRadius: 99, backgroundColor: c }} />
      ))}
      {titulo ? <span style={{ marginLeft: 16, fontSize: 18, color: color.secundario }}>{titulo}</span> : null}
    </div>
    <div style={{ width: ancho, height: alto - 40, position: "relative", overflow: "hidden" }}>{children}</div>
  </div>
);
