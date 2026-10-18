import { color, fuente, sombra } from "../tema";

/** Globo de texto sobre una captura para señalar algo. */
export const Nota: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      position: "absolute",
      backgroundColor: color.tinta,
      color: "#fff",
      fontFamily: fuente,
      fontSize: 34,
      fontWeight: 500,
      lineHeight: 1.3,
      padding: "20px 28px",
      borderRadius: 18,
      boxShadow: sombra,
      maxWidth: 620,
      ...style,
    }}
  >
    {children}
  </div>
);
