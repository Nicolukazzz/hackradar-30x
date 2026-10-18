import { Easing, interpolate, spring } from "remotion";

/** 0 → 1 con un resorte suave (sin rebote), empezando en `desde` (frames). */
export const entrada = (frame: number, fps: number, desde = 0, duracion = 24) =>
  spring({ frame: frame - desde, fps, config: { damping: 200 }, durationInFrames: duracion });

/** 0 → 1 lineal con curva tipo Apple entre dos frames. */
export const tramo = (frame: number, desde: number, hasta: number) =>
  interpolate(frame, [desde, hasta], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

/** Sube y aparece: opacidad + desplazamiento vertical. */
export const subir = (p: number, distancia = 24) => ({ opacity: p, translate: `0px ${(1 - p) * distancia}px` });
