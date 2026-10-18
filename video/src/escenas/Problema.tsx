import { Interactive, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir, tramo } from "../animar";
import { Encabezado } from "../componentes/Encabezado";
import { Fondo } from "../componentes/Fondo";
import { color, fuenteMono, sombra } from "../tema";

// 2 · Problema (14 s): los cinco pasos manuales del brief de Blinka y por qué hoy no se le confía el pago a un agente.
const pasos = [
  ["Llega la factura", "por correo, PDF o chat"],
  ["Alguien la revisa", "y la compara con lo acordado"],
  ["Pide aprobación", "por chat o correo"],
  ["Crea el pago a mano", "en otra moneda y otro país"],
  ["Concilia", "en una hoja de cálculo"],
] as const;

const ProblemaInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const apagar = tramo(frame, 6.5 * fps, 7.3 * fps);
  const frase = entrada(frame, fps, 7 * fps, 30);
  const confianza = entrada(frame, fps, 9.6 * fps, 30);
  const subrayado = tramo(frame, 10.4 * fps, 11.4 * fps);
  return (
    <Fondo>
      <Encabezado kicker="Así se paga hoy" titulo="Cinco pasos manuales por cada factura" />
      <div style={{ position: "absolute", left: 140, right: 140, top: 400, display: "flex", gap: 24 }}>
        {pasos.map(([t, d], i) => {
          const p = entrada(frame, fps, 20 + i * 10);
          return (
            <div
              key={t}
              style={{
                ...subir(p, 40),
                flex: 1,
                backgroundColor: color.superficie,
                borderRadius: 22,
                boxShadow: sombra,
                border: `1px solid ${color.borde}`,
                padding: "30px 28px",
                opacity: p * (1 - 0.55 * apagar),
              }}
            >
              <div style={{ fontFamily: fuenteMono, fontSize: 26, color: color.secundario }}>0{i + 1}</div>
              <div style={{ marginTop: 18, fontSize: 36, fontWeight: 600, lineHeight: 1.15 }}>{t}</div>
              <div style={{ marginTop: 10, fontSize: 26, color: color.secundario, lineHeight: 1.3 }}>{d}</div>
              <div style={{ marginTop: 22, display: "inline-block", fontSize: 22, fontWeight: 600, color: color.frenada.texto, backgroundColor: color.frenada.fondo, borderRadius: 999, padding: "6px 14px" }}>Manual</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 140, right: 140, top: 760 }}>
        <div style={{ ...subir(frase), fontSize: 52, fontWeight: 500, color: color.secundario }}>Todo depende de que una persona esté disponible.</div>
        <div style={{ ...subir(confianza), marginTop: 22, fontSize: 64, fontWeight: 600, letterSpacing: "-0.02em", position: "relative", display: "inline-block", isolation: "isolate" }}>
          Para delegarlo a un agente falta una cosa: confianza.
          <div style={{ position: "absolute", left: 0, bottom: -6, height: 12, width: `${subrayado * 100}%`, backgroundColor: color.acento, borderRadius: 6, zIndex: -1 }} />
        </div>
      </div>
    </Fondo>
  );
};

export const Problema = Interactive.create({ Component: ProblemaInner, layout: "absolute-fill" });
