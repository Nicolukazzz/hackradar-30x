import { useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir } from "../animar";
import { color, fuenteMono } from "../tema";

/** Lista corta de pasos numerados que aparecen uno a uno (en segundos desde el inicio de la escena). */
export const Pasos: React.FC<{ pasos: { t: number; texto: string }[]; style?: React.CSSProperties }> = ({ pasos, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26, ...style }}>
      {pasos.map((p, i) => {
        const a = entrada(frame, fps, p.t * fps);
        const activo = frame >= p.t * fps && (i === pasos.length - 1 || frame < pasos[i + 1].t * fps);
        return (
          <div key={p.texto} style={{ ...subir(a, 18), display: "flex", gap: 18, alignItems: "flex-start" }}>
            <span style={{ fontFamily: fuenteMono, fontSize: 26, fontWeight: 600, width: 46, height: 46, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, backgroundColor: activo ? color.acento : color.sutil, color: color.tinta }}>
              {i + 1}
            </span>
            <span style={{ fontSize: 32, lineHeight: 1.3, fontWeight: activo ? 600 : 500, color: activo ? color.tinta : color.secundario }}>{p.texto}</span>
          </div>
        );
      })}
    </div>
  );
};
