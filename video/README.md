# Video del pitch (Remotion)

Animaciones y capturas para el pitch. Guion completo: [`docs/pitch/guion.md`](../docs/pitch/guion.md).

Proyecto aparte de la app (su propio `package.json`): no entra al build de Railway, al typecheck ni al lint de la raíz.

```bash
cd video
npm install
npm run studio          # vista previa interactiva (http://localhost:3000)
npm run render          # out/pitch.mp4 — las 9 escenas unidas (~2:07)
npm run render:escenas  # out/escenas/E1-Gancho.mp4 … E9-Cierre.mp4
npm run render:rotulo   # out/rotulo.mov — rótulo del presentador con transparencia (ProRes 4444)
npm run render:todo     # todo lo anterior
```

`out/` no se versiona. Remotion trae su propio ffmpeg; no hace falta instalarlo. Licencia: Remotion es gratis para equipos de hasta 3 personas.

## Composiciones

| Id | Duración | Qué muestra |
|---|---|---|
| `Pitch` | 127 s | Las 9 escenas en orden con fundidos de 0,5 s |
| `E1-Gancho` | 8 s | El problema en cuatro líneas y la pregunta |
| `E2-Problema` | 14 s | Los 5 pasos manuales del brief de Blinka; falta confianza |
| `E3-ComoFunciona` | 18 s | Canales → ingesta → lee → 11 reglas → veredicto, y el registro |
| `E4-Veredictos` | 14 s | FAC-1041 pagada, PX-77 frenada, LF-2026-10 escalada, con su porqué |
| `E5-Bandeja` | 14 s | Captura de la Bandeja con zoom a indicadores, presupuesto y lista |
| `E6-Trampas` | 24 s | Inyección (OMI-3381, R10), duplicado (INV-2210, R2), cuenta cambiada (F-0101, R4) |
| `E7-PersonaDecide` | 16 s | Pendientes → traza y decisión humana → registro |
| `E8-Metricas` | 13 s | 0 pagos fuera de reglas · 66,7 % autonomía · 30/30 |
| `E9-Cierre` | 10 s | La promesa y la firma |
| `Rotulo` | 5 s | Nombre y rol del presentador (editable en Studio) |

## Estructura

- `src/tema.ts`: colores y fuentes de la app (especificación §15), Geist y Geist Mono.
- `src/animar.ts`: `entrada` (resorte sin rebote), `tramo` (curva tipo Apple), `subir`.
- `src/componentes/`: `Pildora`, `TarjetaFactura`, `Captura` (paneo y zoom entre tomas), `Nota`, `Encabezado`, `Fondo`, `Rotulo`.
- `src/escenas/`: una escena por archivo, cada una con `Interactive.create` (editable en Studio).
- `public/capturas/`: capturas de la app a 3840×2160.

## Volver a tomar las capturas

Siempre desde la app **local** con el escenario de prueba (datos ficticios), nunca desde producción:

```bash
# en la raíz, con el buzón y las llaves en blanco para no tocar el Gmail real
CORREO_IMAP_USUARIO= CORREO_IMAP_CLAVE= TELEGRAM_BOT_TOKEN= GEMINI_API_KEY= GROQ_API_KEY= ANTHROPIC_API_KEY= \
REPOSITORIO=memoria AVISOS=0 LLM_PROVIDER=ninguno ESCENARIO=lote-demo-oct DEMO=1 npx next dev -p 3123
```

Entrar con una cuenta admin, `POST /api/procesar` (o «Procesar facturas nuevas») y capturar a 1920×1080 con `deviceScaleFactor: 2`: `/`, `/pendientes`, `/registro`, `/facturas/INT-2026-000011` (traza de OMI-3381) y `/facturas/INT-2026-000008` → «Decidir ahora» (`decision.png`). En las capturas, el nombre y el correo de la cuenta de prueba se reemplazaron por «Laura Méndez · laura@nebula.example» (aprobadora ficticia del dataset).

## Skills de Remotion

Las 12 skills oficiales (`remotion-dev/skills`) están en `.claude/skills/remotion-*` y en `skills-lock.json`. Empezar por `/remotion-best-practices` (enrutador); para escenas, `remotion-markup`; para exportar, `remotion-render`. Actualizar con `npx skills update`.
