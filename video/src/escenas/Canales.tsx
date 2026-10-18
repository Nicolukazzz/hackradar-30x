import { Interactive, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir } from "../animar";
import { Fondo } from "../componentes/Fondo";
import { color, sombra } from "../tema";

// 2 · Canales (4 s): por dónde llegan las facturas.
const canales = [
  { nombre: "WhatsApp", tono: "#25D366" },
  { nombre: "Portal del proveedor", tono: color.acento },
  { nombre: "Correo", tono: color.enlace },
  { nombre: "Telegram", tono: "#2AABEE" },
];

const CanalesInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = entrada(frame, fps, 0, 24);
  return (
    <Fondo>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 70 }}>
        <div style={{ ...subir(t, 24), fontSize: 92, fontWeight: 600, letterSpacing: "-0.035em", textAlign: "center", lineHeight: 1.08 }}>
          La factura llega por donde
          <br />
          el proveedor ya escribe.
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          {canales.map((c, i) => {
            const p = entrada(frame, fps, 0.6 * fps + i * 5, 24);
            return (
              <div key={c.nombre} style={{ ...subir(p, 40), display: "flex", alignItems: "center", gap: 16, backgroundColor: color.superficie, border: `1px solid ${color.borde}`, boxShadow: sombra, borderRadius: 999, padding: "20px 34px", fontSize: 38, fontWeight: 600 }}>
                <span style={{ width: 18, height: 18, borderRadius: 99, backgroundColor: c.tono }} />
                {c.nombre}
              </div>
            );
          })}
        </div>
      </div>
    </Fondo>
  );
};

export const Canales = Interactive.create({ Component: CanalesInner, layout: "absolute-fill" });
