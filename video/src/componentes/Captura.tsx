import { Img, interpolate, Easing, staticFile, useCurrentFrame } from "remotion";
import { color, sombra } from "../tema";

/** Un punto de cámara sobre la captura: en el frame `f`, centrar (x, y) en proporción 0–1 con `zoom`. */
export type Toma = { f: number; x: number; y: number; zoom: number };

/**
 * Captura de la app en una ventana con sombra, con paneo y zoom entre tomas (curva suave). Las capturas son 3840×2160
 * (pantalla de 1920×1080 a 2×), así el zoom se ve nítido.
 */
export const Captura: React.FC<{ src: string; tomas: Toma[]; ancho?: number; alto?: number; style?: React.CSSProperties }> = ({ src, tomas, ancho = 1640, alto = 922, style }) => {
  const frame = useCurrentFrame();
  const fs = tomas.map((t) => t.f);
  const op = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.45, 0, 0.2, 1) } as const;
  const zoom = tomas.length > 1 ? interpolate(frame, fs, tomas.map((t) => t.zoom), op) : tomas[0].zoom;
  const x = tomas.length > 1 ? interpolate(frame, fs, tomas.map((t) => t.x), op) : tomas[0].x;
  const y = tomas.length > 1 ? interpolate(frame, fs, tomas.map((t) => t.y), op) : tomas[0].y;
  // Imagen escalada a `ancho * zoom`; se desplaza para que (x, y) quede al centro sin salirse del marco.
  const w = ancho * zoom;
  const h = (w * 9) / 16;
  const left = Math.min(0, Math.max(ancho - w, ancho / 2 - x * w));
  const top = Math.min(0, Math.max(alto - h, alto / 2 - y * h));
  return (
    <div style={{ width: ancho, height: alto, borderRadius: 22, overflow: "hidden", position: "relative", boxShadow: sombra, border: `1px solid ${color.bordeFuerte}`, backgroundColor: color.superficie, ...style }}>
      <Img src={staticFile(src)} style={{ position: "absolute", width: w, height: h, left, top }} />
    </div>
  );
};
