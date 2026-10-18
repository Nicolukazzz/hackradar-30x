import { useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir } from "../animar";
import { color } from "../tema";

/** Rótulo pequeño + título grande arriba a la izquierda de una escena. */
export const Encabezado: React.FC<{ kicker: string; titulo: React.ReactNode; oscuro?: boolean; desde?: number }> = ({ kicker, titulo, oscuro = false, desde = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = entrada(frame, fps, desde);
  const b = entrada(frame, fps, desde + 6);
  return (
    <div style={{ position: "absolute", left: 140, top: 110, right: 140 }}>
      <div style={{ ...subir(a, 16), fontSize: 30, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: oscuro ? color.acento : color.secundario }}>
        {kicker}
      </div>
      <div style={{ ...subir(b), marginTop: 18, fontSize: 84, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.05 }}>{titulo}</div>
    </div>
  );
};
