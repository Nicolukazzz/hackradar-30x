# Video del pitch de Quadra (Remotion)

Animaciones, grabaciones y capturas del pitch. Guion completo: [`docs/pitch/guion.md`](../docs/pitch/guion.md).

Proyecto aparte de la app (su propio `package.json`): no entra al build de Railway, al typecheck ni al lint de la raíz.

```bash
cd video
npm install
npm run studio          # vista previa interactiva (http://localhost:3000)
npm run render          # out/pitch.mp4 — video completo con apertura y voz (2:35)
npm run render:escenas  # out/escenas/E01-Intro.mp4 … E10-Cierre.mp4
npm run render:rotulo   # out/rotulo.mov — rótulo del presentador con transparencia (ProRes 4444)
npm run render:todo     # todo lo anterior
```

`out/` no se versiona. Remotion trae su propio ffmpeg. Licencia: gratis para equipos de hasta 3 personas.

## Presentador en el círculo

Las escenas WhatsApp, Portal y Por dentro tienen un círculo de cámara abajo a la derecha. Guardar la toma del presentador en `public/camara/whatsapp`, `portal` y `por-dentro` (`.mp4` o `.mov`) y volver a exportar: si el archivo existe, se reproduce en el círculo con su audio; si no, se ve un marcador. La apertura a pantalla completa es `public/camara/intro.mov` y la voz en off de las demás escenas va en `public/voz/{canales,llegada,como-funciona,roles,moneda,cierre}.m4a`. Estas carpetas no se versionan (el repo es público): cada quien las copia en su máquina.

## Composiciones

| Id | Duración | Qué muestra |
|---|---|---|
| `Pitch` | 155 s | Apertura del presentador + 10 escenas con fundidos de 0,5 s, con voz |
| `E00-Presentador` | 14,5 s | Apertura en cámara |
| `E01-Intro` | 5 s | Quadra y la promesa |
| `E02-Canales` | 5 s | WhatsApp, portal, correo, Telegram |
| `E03-WhatsApp` | 14 s | Grabación real: el proveedor manda fotos de factura por WhatsApp |
| `E04-Portal` | 29 s | Grabación real: el admin da acceso (enlace + código) y el proveedor sube 3 facturas |
| `E05-Llegada` | 13 s | Animación: la bandeja recibe facturas y cada una queda Pagada / Frenada / Escalada |
| `E06-ComoFunciona` | 18 s | La IA lee (doble lectura), el algoritmo decide |
| `E07-PorDentro` | 18 s | Traza de una factura: explicación, instrucción escondida, reglas |
| `E08-Roles` | 24 s | Vista del tesorero, del aprobador y del administrador |
| `E09-Moneda` | 12,5 s | Cambio de moneda base con los montos convirtiéndose |
| `E10-Cierre` | 7 s | Quadra · Hackathon 30X |
| `Rotulo` | 5 s | Nombre y rol del presentador (editable en Studio) |

## Estructura

- `src/tema.ts`: colores y fuentes de la app (especificación §15), Geist y Geist Mono.
- `src/componentes/`: `Pildora`, `Captura` (paneo y zoom), `Ventana`, `Etiqueta` («Vista del …»), `Camara` (círculo), `Pasos`, `Nota`, `Encabezado`, `Fondo`, `Rotulo`.
- `src/escenas/`: una escena por archivo (`Interactive.create`, editable en Studio).
- `public/capturas/`: capturas de la app a 3840×2160. `public/medios/`: grabaciones (H.264, sin audio).

## Volver a grabar o capturar

Siempre desde la app **local** con el set de prueba (datos ficticios), nunca desde producción. En la raíz, con buzón, canales y clave de Supabase en blanco (los enlaces de proveedor quedan en memoria, sin tocar la base del equipo):

```bash
CORREO_IMAP_USUARIO= CORREO_IMAP_CLAVE= TELEGRAM_BOT_TOKEN= WHATSAPP_TOKEN= SUPABASE_SECRET_KEY= \
REPOSITORIO=memoria AVISOS=0 LLM_PROVIDER=gemini ESCENARIO=lote-demo-oct DEMO=1 npx next dev -p 3123
```

- Capturas: 1920×1080 con `deviceScaleFactor: 2`, después de `POST /api/procesar`.
- Grabaciones: Playwright con `recordVideo` (1920×1080; instalar su ffmpeg con `npx playwright install ffmpeg`), convertidas a H.264 con `npx remotion ffmpeg … -r 30 -c:v libx264 -crf 20 -pix_fmt yuv420p -an`.
- Portal: Proveedores → «Dar acceso al portal» con CloudNorte (`billing@cloudnorte.example`); el proveedor sube `data/escenarios/demo-en-vivo/documentos/adjuntos/002-inv-2216.pdf` (sale aprobada) y dos fotos de factura de ejemplo.
- WhatsApp: grabación de pantalla del equipo (0–14,3 s), escalada a 1600 px.
- En capturas y grabaciones del panel, el nombre y correo de la cuenta de prueba se reemplazan por «Laura Méndez · laura@nebula.example» (aprobadora ficticia del set).

## Skills de Remotion

Las 12 skills oficiales (`remotion-dev/skills`) están en `.claude/skills/remotion-*` y en `skills-lock.json`. Empezar por `/remotion-best-practices`; para escenas, `remotion-markup`; para exportar, `remotion-render`.
