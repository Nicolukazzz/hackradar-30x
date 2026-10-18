import { Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { entrada, subir, tramo } from "../animar";
import { Encabezado } from "../componentes/Encabezado";
import { Fondo } from "../componentes/Fondo";
import { Pildora } from "../componentes/Pildora";
import { color, fuenteMono, sombra } from "../tema";

// 6 · Cómo funciona (16 s, voz en off): canales → ingesta → la IA lee (doble lectura) → el algoritmo decide → veredicto.
const X = [140, 485, 830, 1175, 1520];
const ANCHO = 260;
const TOP = 470;
const ALTO = 330;

const Caja: React.FC<{ x: number; p: number; titulo: string; lineas: string[]; acento?: boolean; etiqueta: string }> = ({ x, p, titulo, lineas, acento, etiqueta }) => (
  <div
    style={{
      ...subir(p, 30),
      position: "absolute",
      left: x,
      top: TOP,
      width: ANCHO,
      height: ALTO,
      borderRadius: 24,
      padding: 28,
      boxSizing: "border-box",
      backgroundColor: acento ? color.tinta : color.superficie,
      color: acento ? "#fff" : color.tinta,
      boxShadow: sombra,
      border: acento ? `3px solid ${color.acento}` : `1px solid ${color.borde}`,
    }}
  >
    <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: acento ? color.acento : color.secundario }}>{etiqueta}</div>
    <div style={{ marginTop: 12, fontSize: 38, fontWeight: 600, letterSpacing: "-0.02em" }}>{titulo}</div>
    {lineas.map((l) => (
      <div key={l} style={{ marginTop: 8, fontSize: 23, lineHeight: 1.3, color: acento ? "rgba(255,255,255,0.75)" : color.secundario }}>
        {l}
      </div>
    ))}
  </div>
);

/** Flecha entre columnas que se dibuja y una "factura" (punto) que la recorre. */
const Flecha: React.FC<{ x1: number; x2: number; desde: number }> = ({ x1, x2, desde }) => {
  const frame = useCurrentFrame();
  const dibujo = tramo(frame, desde, desde + 14);
  const viaje = ((frame - desde) % 45) / 45;
  const y = TOP + ALTO / 2;
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1920} height={1080}>
      <line x1={x1} y1={y} x2={x1 + (x2 - x1) * dibujo} y2={y} stroke={color.bordeFuerte} strokeWidth={4} strokeLinecap="round" />
      {frame > desde + 14 ? <circle cx={x1 + (x2 - x1) * viaje} cy={y} r={9} fill={color.tinta} opacity={interpolate(viaje, [0, 0.15, 0.85, 1], [0, 1, 1, 0])} /> : null}
    </svg>
  );
};

const ComoFuncionaInner = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const canales = ["WhatsApp", "Portal", "Correo", "Telegram"];
  const registro = entrada(frame, fps, 9 * fps);
  const nota = entrada(frame, fps, 11.5 * fps, 30);
  return (
    <Fondo>
      <Encabezado kicker="Cómo funciona" titulo={<>Un agente de IA lee la factura.<br />Un algoritmo decide.</>} />

      {/* Canales */}
      <div style={{ position: "absolute", left: X[0], top: TOP, width: ANCHO, height: ALTO, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        {canales.map((c, i) => (
          <div key={c} style={{ ...subir(entrada(frame, fps, 1 * fps + i * 5), 20), height: 62, borderRadius: 16, backgroundColor: color.superficie, border: `1px solid ${color.borde}`, boxShadow: sombra, display: "flex", alignItems: "center", paddingLeft: 24, fontSize: 30, fontWeight: 500 }}>
            {c}
          </div>
        ))}
      </div>

      <Flecha x1={X[0] + ANCHO + 8} x2={X[1] - 8} desde={2 * fps} />
      <Caja x={X[1]} p={entrada(frame, fps, 2.4 * fps)} etiqueta="Ingesta" titulo="Recibe" lineas={["Número interno propio", "Identifica al remitente", "Descarta archivos repetidos"]} />
      <Flecha x1={X[1] + ANCHO + 8} x2={X[2] - 8} desde={3.4 * fps} />
      <Caja x={X[2]} p={entrada(frame, fps, 3.8 * fps)} etiqueta="Lee · IA" titulo="Agente IA" lineas={["Fotos, PDF y correos", "Doble lectura: 2 de 3", "deben coincidir"]} />
      <Flecha x1={X[2] + ANCHO + 8} x2={X[3] - 8} desde={4.8 * fps} />
      <Caja x={X[3]} p={entrada(frame, fps, 5.2 * fps)} acento etiqueta="Decide" titulo="11 reglas" lineas={["Algoritmo determinista", "Duplicados, límites,", "presupuesto y cuenta"]} />
      <Flecha x1={X[3] + ANCHO + 8} x2={X[4] - 8} desde={6.2 * fps} />

      {/* Veredictos */}
      <div style={{ position: "absolute", left: X[4], top: TOP, width: ANCHO, height: ALTO, display: "flex", flexDirection: "column", justifyContent: "space-around" }}>
        {(["pagada", "frenada", "escalada"] as const).map((e, i) => (
          <div key={e} style={subir(entrada(frame, fps, 6.6 * fps + i * 8), 20)}>
            <Pildora estado={e} tamano={38} />
          </div>
        ))}
      </div>

      {/* Registro */}
      <div style={{ ...subir(registro, 20), position: "absolute", left: X[0], right: 140, top: TOP + ALTO + 40, height: 86, borderRadius: 20, backgroundColor: color.sutil, border: `1px solid ${color.borde}`, display: "flex", alignItems: "center", gap: 24, paddingLeft: 32 }}>
        <span style={{ fontSize: 30, fontWeight: 600 }}>Registro</span>
        <span style={{ fontSize: 28, color: color.secundario }}>cada decisión con sus datos, reglas y explicación · nunca se edita</span>
        <span style={{ marginLeft: "auto", marginRight: 32, fontFamily: fuenteMono, fontSize: 26, color: color.secundario, whiteSpace: "nowrap" }}>REG-2026-000011</span>
      </div>

      <div
        style={{
          ...subir(nota, 20),
          position: "absolute",
          left: X[2] - 20,
          top: TOP - 92,
          backgroundColor: color.acento,
          color: color.tinta,
          fontSize: 32,
          fontWeight: 600,
          padding: "14px 24px",
          borderRadius: 14,
        }}
      >
        Si la IA duda, no se paga
      </div>
    </Fondo>
  );
};

export const ComoFunciona = Interactive.create({ Component: ComoFuncionaInner, layout: "absolute-fill" });
