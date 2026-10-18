import { color, fuente, NOMBRE_ESTADO, type Estado } from "../tema";

export const Pildora: React.FC<{ estado: Estado; tamano?: number; texto?: string; style?: React.CSSProperties }> = ({ estado, tamano = 28, texto, style }) => {
  const c = color[estado];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: tamano * 0.4,
        padding: `${tamano * 0.28}px ${tamano * 0.7}px`,
        borderRadius: 999,
        backgroundColor: c.fondo,
        color: c.texto,
        fontFamily: fuente,
        fontWeight: 600,
        fontSize: tamano,
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span style={{ width: tamano * 0.36, height: tamano * 0.36, borderRadius: 999, backgroundColor: c.punto }} />
      {texto ?? NOMBRE_ESTADO[estado]}
    </span>
  );
};
