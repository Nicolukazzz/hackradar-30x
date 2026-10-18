import { Video } from "@remotion/media";
import { Easing, Interactive, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir } from "../animar";
import { Camara } from "../componentes/Camara";
import { Encabezado } from "../componentes/Encabezado";
import { Fondo } from "../componentes/Fondo";
import { Pasos } from "../componentes/Pasos";
import { Ventana } from "../componentes/Ventana";
import { color, fuente, fuenteMono } from "../tema";

// 3 · WhatsApp (15 s): grabación real del proveedor mandando dos fotos de factura al número de la empresa.
const W = 900;
const H = Math.round((W * 1220) / 1600) + 40;

const tomas = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.45, 0, 0.2, 1) } as const;

const WhatsAppInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const respuesta = entrada(frame, fps, 11 * fps, 20);
  return (
    <Fondo>
      <Encabezado kicker="Canal · WhatsApp" titulo="El proveedor manda la foto. Listo." />
      <Ventana ancho={W} alto={H} titulo="WhatsApp · proveedor" style={{ position: "absolute", left: 140, top: 300 }}>
        <Video
          src={staticFile("medios/whatsapp.mp4")}
          style={{
            position: "absolute",
            width: W,
            height: H - 40,
            transformOrigin: `${interpolate(frame, [0, 4.5 * fps, 6 * fps, 9.5 * fps, 10.8 * fps], [45, 45, 50, 50, 92], tomas)}% ${interpolate(frame, [0, 4.5 * fps, 6 * fps, 9.5 * fps, 10.8 * fps], [45, 45, 50, 50, 8], tomas)}%`,
            scale: String(interpolate(frame, [0, 4.5 * fps, 6 * fps, 9.5 * fps, 10.8 * fps], [1.45, 1.45, 1.15, 1.15, 2.1], tomas)),
          }}
        />
        {/* Respuesta automática del agente (texto de ejemplo con el formato que usa el canal). */}
        <div
          style={{
            ...subir(respuesta, 20),
            position: "absolute",
            left: 24,
            bottom: 70,
            maxWidth: 520,
            backgroundColor: "#FFFFFF",
            borderRadius: "18px 18px 18px 6px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: "16px 20px",
            fontFamily: fuente,
            fontSize: 22,
            lineHeight: 1.4,
            color: color.tinta,
          }}
        >
          <b>Recibimos tus 2 facturas.</b>
          <br />
          Ref. <span style={{ fontFamily: fuenteMono }}>INT-2026-000016</span> y <span style={{ fontFamily: fuenteMono }}>-000017</span>. Te avisamos aquí en qué quedan.
        </div>
      </Ventana>
      <Pasos
        style={{ position: "absolute", left: 1100, right: 140, top: 330 }}
        pasos={[
          { t: 0.6, texto: "Escribe al número de la empresa" },
          { t: 5, texto: "Adjunta la foto o el PDF" },
          { t: 10.8, texto: "Quadra responde con su número de seguimiento" },
        ]}
      />
      <Camara clip="whatsapp" />
    </Fondo>
  );
};

export const WhatsApp = Interactive.create({ Component: WhatsAppInner, layout: "absolute-fill" });
