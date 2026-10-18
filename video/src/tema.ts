// Tokens de la app (especificación §15) para que el video se vea como el producto.
import { loadFont } from "@remotion/google-fonts/Geist";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";

export const { fontFamily: fuente } = loadFont("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"] });
export const { fontFamily: fuenteMono } = loadMono("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

export const color = {
  tinta: "#101614",
  secundario: "#5B6661",
  fondo: "#F7F8F5",
  superficie: "#FFFFFF",
  sutil: "#EEF0EC",
  borde: "#E3E6E1",
  bordeFuerte: "#D5D9D3",
  acento: "#C8F169",
  enlace: "#1F4FD1",
  pagada: { fondo: "#E3F4EC", texto: "#0B6B47", punto: "#0E7A52" },
  frenada: { fondo: "#FDECEA", texto: "#A3201A", punto: "#B42318" },
  escalada: { fondo: "#FFF1D6", texto: "#7A4900", punto: "#B76E00" },
} as const;

export type Estado = "pagada" | "frenada" | "escalada";
export const NOMBRE_ESTADO: Record<Estado, string> = { pagada: "Pagada", frenada: "Frenada", escalada: "Escalada" };

export const sombra = "0 1px 2px rgba(16,22,20,0.06), 0 12px 32px rgba(16,22,20,0.08)";
