import { AbsoluteFill } from "remotion";
import { color, fuente } from "../tema";

/** Fondo claro de la app con una rejilla muy tenue. `oscuro` para portadas. */
export const Fondo: React.FC<{ oscuro?: boolean; children?: React.ReactNode }> = ({ oscuro = false, children }) => (
  <AbsoluteFill
    style={{
      backgroundColor: oscuro ? color.tinta : color.fondo,
      backgroundImage: oscuro
        ? "radial-gradient(circle at 70% 20%, rgba(200,241,105,0.10), transparent 55%)"
        : "radial-gradient(circle at 80% 0%, rgba(200,241,105,0.18), transparent 50%)",
      color: oscuro ? "#FFFFFF" : color.tinta,
      fontFamily: fuente,
    }}
  >
    {children}
  </AbsoluteFill>
);
