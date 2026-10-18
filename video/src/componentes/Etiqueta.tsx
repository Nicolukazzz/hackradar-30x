import { color, fuente } from "../tema";

/** Rótulo tipo «Vista del tesorero»: píldora oscura con punto verde lima. */
export const Etiqueta: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 14,
      backgroundColor: color.tinta,
      color: "#fff",
      fontFamily: fuente,
      fontSize: 30,
      fontWeight: 600,
      padding: "14px 26px",
      borderRadius: 999,
      boxShadow: "0 12px 30px rgba(16,22,20,0.25)",
      ...style,
    }}
  >
    <span style={{ width: 14, height: 14, borderRadius: 99, backgroundColor: color.acento }} />
    {children}
  </div>
);
