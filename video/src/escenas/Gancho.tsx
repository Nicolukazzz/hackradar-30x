import { Interactive, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir, tramo } from "../animar";
import { Fondo } from "../componentes/Fondo";
import { color } from "../tema";

// 1 · Gancho (8 s): el problema en cuatro líneas y la pregunta del pitch.
const lineas = ["Cada mes,", "decenas de facturas,", "en varias monedas y países,", "revisadas y pagadas a mano."];

const GanchoInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const salida = 1 - tramo(frame, 4.2 * fps, 4.8 * fps);
  const pregunta = entrada(frame, fps, 4.9 * fps, 30);
  const remate = entrada(frame, fps, 6 * fps, 30);
  return (
    <Fondo oscuro>
      <div style={{ position: "absolute", left: 160, top: 250, opacity: salida }}>
        {lineas.map((l, i) => (
          <div key={l} style={{ ...subir(entrada(frame, fps, 8 + i * 16), 30), fontSize: 96, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.12, color: i === 3 ? color.acento : "#fff" }}>
            {l}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 160, right: 160, top: 330, opacity: 1 - salida }}>
        <div style={{ ...subir(pregunta, 30), fontSize: 104, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.08 }}>¿Y si un agente pagara por la empresa…</div>
        <div style={{ ...subir(remate, 30), marginTop: 28, fontSize: 104, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.08, color: color.acento }}>
          sin salirse nunca de las reglas?
        </div>
      </div>
    </Fondo>
  );
};

export const Gancho = Interactive.create({ Component: GanchoInner, layout: "absolute-fill" });
