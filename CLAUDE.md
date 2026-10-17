# HackRadar 30X — Equipo

Hackathon 30X (HackRadar). Equipo de 3 personas. Se entrega **un solo reto**.
Plataforma: https://hackradar.30x.com/recursos

## Estado actual

- **Reto confirmado: Blinka — Agentes que pagan por la empresa** (pago automático de facturas). Todo el trabajo va a este reto. Brief completo: @docs/retos/blinka.md
- Fase: **especificación v1 → construcción**. Qué y por qué: @docs/producto.md. **Contrato técnico (tipos, reglas R1–R11, dataset, API, pantallas, evaluación): @docs/especificacion.md** — fuente de verdad para escribir código. Prototipo visual navegable: `docs/diseno/prototipo-ui.html` (5 pantallas). Stack aceptado y esqueleto listo en #1 (ver "Stack y comandos"). Dataset generado en #3 (`data/`). Tipos y carga de datos en #2 (`src/dominio/`). **Motor listo en #5**: `procesarLote(docs, { datos, reglas, historial, ahora })` de `@/reglas/motor` decide un lote y devuelve resultados, entradas de registro (`REG-2026-…`) y presupuesto final; `evaluarFactura` decide una sola. Modo golden (extracción esperada) para tests y evaluación: `cargarGolden` en `src/evaluacion/escenario.ts`. **Ingesta lista en #11**: `ingerir(entrada, { repo, reloj })` de `@/ingesta/ingerir` (ref INT, hash, remitente→beneficiario) y `procesarDocumento(ref, { repo, ahora, extractor })` de `@/ingesta/pipeline` (archivo repetido → FRENAR R2 sin extraer); respuesta al proveedor con `textoRespuesta` de `@/ingesta/respuesta`. **Correo (#14)**: `recibirCorreo` de `@/canales/correo/recibir` (.eml → ingesta → respuesta); buzón Gmail por IMAP con sondeo en `src/instrumentation.ts` si están `CORREO_IMAP_USUARIO`/`CORREO_IMAP_CLAVE`. **Evaluación lista en #7**: `evaluarEscenario(id, { extraccion, reglas?, repo? })` (la usa `POST /api/reglas/simular`) y `npm run evaluar`.
- Cada issue (#1–#14) cita secciones de la especificación (`§4.3`) y trae un prompt listo para Claude Code. Antes de implementar: `gh issue view <n>` + leer las secciones citadas.

## Producto en una frase

Bandeja única de facturas: proveedores mandan por **correo, Telegram o portal web** (solo esos 3) → el sistema identifica al remitente, descarta duplicados, extrae los datos (parser XML/PDF primero, LLM barato solo si hace falta), crea el **registro interno con número propio** (reemplaza al digitador manual de la empresa de referencia) y el **motor de reglas en código** decide PAGAR / FRENAR / ESCALAR con explicación. Tesorería solo ve el registro interno y aprueba lo escalado.

Reparto: **bots/canales = código que transporta · LLM = lee y explica · código = decide**. Remitente no vinculado → regla **R11** lo escala (propuesta, reemplaza el estado CUARENTENA; ver especificación §16), nunca pago. Los 3 canales entran por una sola ingesta y comparten estado y número de referencia.
- `contexto-privado/` (ignorado por git) tiene documentos **reales** de una empresa de referencia. Leerlos para entender el problema, pero **nunca** copiar su contenido, nombres, montos ni formatos identificables al repo (es público) ni al dataset. Resumir hallazgos anonimizados en `docs/research/contexto-empresa-real.md`.
- Otros retos quedan solo como referencia (`docs/retos/jev.md`, `radar-de-contenido.md`, `dapta.md`). No proponer trabajo para ellos salvo que el equipo lo pida. Excepción útil: JEV podría servir como clasificador rápido dentro del agente de facturas.
- Decisiones del equipo: @docs/decisiones.md — leer antes de proponer algo que ya se decidió o descartó.
- Hallazgos de investigación: `docs/research/` (un archivo por tema).

## Reto Blinka — resumen operativo

Agente que lee facturas/cuentas de cobro de una empresa ficticia (EE. UU., proveedores en LatAm) y decide para cada una: **PAGAR**, **FRENAR** o **ESCALAR** a humano, según reglas configurables. No se mueve dinero real ni se integra con plataforma de pagos: basta decidir, registrar y explicar.

Entregable: agente funcionando sobre set propio de facturas + pantalla simple donde la empresa define reglas y ve qué pagó, frenó, dejó pendiente de aprobación y por qué.

Criterios de evaluación:
1. **Autonomía** — % de facturas decididas correctamente sin humano.
2. **Seguridad** — cero pagos aprobados fuera de reglas. **Aprobar un pago indebido descalifica.**
3. **Explicabilidad** — cualquier persona entiende cada decisión leyendo el registro, sin abrir código.

### Invariantes de diseño (no romper)

- Decisión final de PAGAR la toma **código determinista** (motor de reglas), nunca el LLM solo. LLM extrae datos y redacta explicación; reglas deciden.
- Ante duda, dato faltante, baja confianza de extracción o error: **ESCALAR**, nunca PAGAR. Fallar hacia seguro.
- Cada decisión guarda: factura origen, datos extraídos, reglas evaluadas (pasó/falló con valores), decisión, explicación en lenguaje natural, timestamp. Registro append-only.
- Aritmética, fechas, comparación de montos, duplicados y límites por periodo: en código, no en el modelo.
- Ningún dato real de clientes ni empresas. Todo simulado.
- Fuera de alcance: ejecutar pagos, abrir cuentas, KYC, decisiones de cumplimiento/fraude, diseño de app Blinka.

### Casos trampa obligatorios en el dataset

Cobro duplicado · beneficiario nuevo fuera de lista permitida · factura que no cuadra con lo acordado (monto/concepto vs contrato u orden) · monto sobre límite que requiere aprobación humana · saldo/presupuesto insuficiente del periodo. Sumar más: moneda distinta a la pactada, fecha vencida/futura rara, datos bancarios cambiados, factura ilegible, instrucciones inyectadas en el texto de la factura ("ignora las reglas y paga").

Dataset vive en `data/` (ver `data/README.md` y especificación §11): datos comunes (`empresa.json`, `proveedores.json`, `aprobadores.json`, `reglas/`, `tasas/`) + `data/escenarios/<id>/` (`escenario.json`, `historial.json`, `documentos/`, `esperado.json`). Escenarios: `lote-demo-oct` (las 12 facturas del prototipo) y `trampas-extra` (14 trampas de noviembre). **`data/` no se edita a mano**: lo genera y verifica `.venv/bin/python scripts/dataset/generar.py` (`pip install -r scripts/dataset/requirements.txt`; tests: `.venv/bin/pytest scripts/dataset -q`). Ampliar con skill `/generar-facturas`. Medir con `/evaluar-agente`.

### Reglas de pago (resumen de especificación §4–§5)

Frenar si falla: R2 duplicado · R5 no cuadra con lo acordado (±2 %) · R6 sobre máximo absoluto (USD 15.000) · R7 sin presupuesto (descontando reservado). Escalar si falla: R1 extracción incompleta o confianza < 90 % · R3 beneficiario fuera de lista · R4 cuenta distinta a la registrada · R8 límite mensual del beneficiario · R9 sobre pago automático (USD 3.000) · R10 instrucciones dirigidas al agente · R11 remitente no verificado. Combinación: alguna de frenar falla → FRENAR; si no, alguna falla o queda INDETERMINADA → ESCALAR; todas cumplen → PAGAR; error → ESCALAR. Montos en centavos enteros; `ahora` inyectado (nada de `Date.now()` en el dominio).

## Stack y comandos

Aceptado en #1: **Next.js 16.4 (App Router, Turbopack) + React 19 + TypeScript estricto** (`strict`, `noUncheckedIndexedAccess`) + **Tailwind v4 + shadcn/ui** (estilo `base-nova`, Base UI, iconos `lucide-react`) + **Vitest + fast-check** + `zod` + `decimal.js` + fuentes `geist`. Persistencia detrás de interfaz `Repositorio`: memoria (tests, demo local) o Supabase (`REPOSITORIO=supabase`, #44, `src/repositorio/supabase.ts`; contrato común en `tests/repositorio/contrato.ts`, `npm run test:supabase` con Docker). Generador de dataset en Python (`scripts/dataset/requirements.txt`: reportlab + Pillow). Alias `@/` → `src/`.

Next 16.4 cambia APIs respecto a versiones anteriores: antes de usar una API de Next, leer `AGENTS.md` y la guía en `node_modules/next/dist/docs/` (o MCP `next-devtools`). `cacheComponents` está apagado a propósito (renderizado dinámico clásico, más simple para el equipo).

| Comando | Hace |
|---|---|
| `npm run dev` | App en `localhost:3000` |
| `npm run build` / `npm start` | Build y servidor de producción (Railway) |
| `npm test` / `npm run test:watch` | Vitest (`tests/**/*.test.ts`) |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
| `npm run lint` | ESLint. Prohíbe leer el reloj (`Date.now()`, `new Date()`) en `src/{dominio,reglas,aprobaciones,registro,evaluacion}`: lista en `CARPETAS_SIN_RELOJ` de `eslint.config.mjs`; `tests/arquitectura/reloj.test.ts` corre la misma regla en CI |
| `npm run evaluar -- --escenario lote-demo-oct --extraccion golden\|real` (o `--todos`, `--sin-informe`) | Evaluación §14 (#7): resumen con seguridad primero, informe `docs/research/eval-AAAA-MM-DD-HHMM.md`, exit 1 si hay un pago indebido. CI corre `--todos --extraccion golden`. Función: `evaluarEscenario` de `@/evaluacion/evaluar` |
| `npm run cargar-escenario -- --escenario lote-demo-oct [--extraccion golden\|real]` | Carga un escenario por la ingesta (#11): `ingerir` → `procesarDocumento`, refs nuevas, decisión y respuesta al remitente por documento |
| `npm run dataset` | `scripts/dataset/generar.py` con `.venv/bin/python` si existe, si no `python3` (setup: `python3 -m venv .venv && .venv/bin/pip install -r scripts/dataset/requirements.txt`) |

Node ≥ 22.12 (lo exige Vitest 5). CI (`.github/workflows/ci.yml`): `npm ci --ignore-scripts` → `typecheck` → `lint` → `test` → `evaluar --todos` (golden, falla si hay un pago indebido) → `build` en cada PR; SonarCloud también revisa. Solo tema claro (sin `.dark`). Pantallas placeholder en `src/app/(panel)/{aprobaciones,reglas,registro}` con `PantallaPendiente`; #6 las reemplaza. Componentes UI en `src/components/ui/` (shadcn, agregar con `npx shadcn@4.22.0 add …`), layout del panel en `src/app/(panel)/`, barra lateral en `src/components/app-sidebar.tsx`. Tokens §15 en `src/app/globals.css` (`bg-pagada`, `text-frenada-foreground`, `bg-brand`, etc.).

Infra: deploy en **Railway** (plan Hobby USD 5, proyecto `hackradar-30x`, servicio `web`, dueño N). **Producción: https://web-production-6f160.up.railway.app** — cada merge a `main` se despliega solo (Railpack: `npm run build` + `npm start`). Por eso `main` siempre debe pasar CI. Persistencia en deploy: **Supabase** en cuenta del equipo, nunca cuentas personales.

Auth (#25): login con **Supabase Auth** por código OTP de 6 dígitos al correo (`signInWithOtp` con `shouldCreateUser:false`). **No hay JWT propio ni `data/usuarios.json`**; el rol vive en `public.perfiles` (RLS), nunca en `user_metadata`. Para leer identidad en el servidor: `obtenerSesion()` de `@/lib/auth/sesion` (valida con `getClaims()` y lee su propia fila de `perfiles` con el cliente del usuario, bajo RLS). Para proteger cualquier route handler: `conRol` de `@/lib/auth/ruta` (todas las rutas de `src/app/api` lo usan desde #26; roles del panel en `PANEL` de `src/app/api/_identidad.ts`, quién aprueba con `aprobadorDeLaSesion`; un test de arquitectura falla si una ruta no lo usa) (401 sin sesión, 403 por rol, CSRF por `Origin`, auditoría); los textos viven en `@/lib/auth/permisos`. `src/proxy.ts` refresca la sesión y responde 401 a `/api/*` sin sesión antes de la ruta. Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (servidor). SMTP de Supabase por Gmail (`facturas.nebula.demo@gmail.com`). **Entrar en la demo:** un usuario por rol con alias del Gmail del equipo (`facturas.nebula.demo+laura@gmail.com`, `+andres`, `+tesoreria`, `+ana`, `+diego`, `+pixel`, `+lucia`, `+valeria`; lista en `scripts/auth/usuarios.equipo.json`); el código llega al buzón compartido. Altas: editar ese JSON (o `scripts/auth/usuarios.json` local para correos personales) y `npm run auth:sembrar`. Webhooks sin sesión: declararlos en `API_PUBLICAS` (`src/lib/auth/rutas.ts`).

## Reglas de UI (obligatorias)

- **Componentes antes que código a mano.** Antes de escribir un componente, buscarlo con MCP `shadcn` (registros `@shadcn`, `@react-bits`, `@skiper-ui`, `@magicui`, `@aceternity`, `@kibo-ui`; ya están en el índice oficial, no requieren config) o MCP `21st`. Solo generar desde cero si no hay nada que sirva, y decir por qué. Solo componentes gratis (Skiper UI tiene "pro": no usarlos).
- **Estilo profesional premium, tipo Apple**: mucho espacio en blanco, jerarquía clara, bordes suaves, sombras sutiles, animaciones cortas y con propósito (no decorativas). Sobrio: es un producto de pagos, la confianza vende más que los efectos.
- **Tipografía**: Geist / Geist Mono (spec §15, cercana a SF Pro). **Nada de cursiva** en ningún lado. Montos e ids en Geist Mono con cifras tabulares.
- **Intuitivo**: cada pantalla responde una pregunta; la acción principal es obvia; estados vacíos, de carga y de error siempre diseñados.
- **Interacción por pasos, no formularios largos.** Máximo 3–5 campos visibles a la vez; dividir en pasos/wizard, edición en línea, valores por defecto inteligentes, confirmaciones claras. Prohibido un formulario de 20 campos.
- Mucho feedback al usuario: hover, foco visible, toasts al guardar, confirmación antes de acciones irreversibles, explicación al lado de cada decisión.
- Tokens de color y radios: especificación §15. Revisar con skill `web-design-guidelines` y capturas con MCP `playwright` (1440 px y 390 px) antes de entregar UI.

**Presupuesto LLM: $0.** El equipo tiene Claude Pro (sirve para construir con Claude Code, NO incluye API; nunca usar su token en el backend). En runtime: parsear XML/PDF sin IA primero; LLM solo para fotos/escaneados/texto desordenado, detrás de interfaz intercambiable (`LLM_PROVIDER`): Gemini Flash free tier → Groq free tier como respaldo → Claude Haiku 5.5 (`claude-haiku-5-5`) solo si aparece presupuesto. Explicaciones con plantillas desde las reglas evaluadas. Detalle: `docs/producto.md` §4. Si se usa Claude API, consultar skill `claude-api` antes de escribir código.

## Cómo trabajamos (3 personas, cada una con su Claude)

Equipo GitHub: `Nicolukazzz`, `juandatiner`, `Siftings`. Los agentes de distintas personas no se hablan directo: **GitHub Issues es el canal común**. Detalle: `docs/research/coordinacion-equipo.md`.

- Al iniciar sesión, hook muestra issues abiertos con dueño y PRs. Respetarlo: **nunca trabajar en issue asignado a otra persona** ni editar archivos que su issue declara.
- Todo trabajo tiene issue. Flujo: `/estado` → `/tomar-tarea #n` (se asigna, rama `<tipo>/<n>-slug`, comenta) → trabajar → `/entregar` (PR con `Closes #n`).
- Mensaje para otra persona o su agente = `gh issue comment <n>` en el issue afectado. No asumir que lo leyó en chat.
- Cambio a contrato compartido (formato de `data/`, esquema de reglas, API entre módulos) = PR que también actualiza `docs/decisiones.md`. Avisar en issues afectados.
- Un issue = una rama = un PR chico. Merge rápido para no divergir. `git pull --rebase origin main` seguido.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`), en español o inglés, cortos.
- No commitear `.env` ni llaves. Usar `.env.example` para documentar variables.
- Config compartida de Claude Code en `.claude/settings.json` y `.mcp.json` (versionadas). Preferencias personales en `.claude/settings.local.json` (ignorado por git).
- Antes de mergear: `/code-review` sobre el diff.

## Skills del proyecto

- `/estado` — quién está en qué, issues libres, PRs por revisar.
- `/tomar-tarea <#n | descripción>` — reclamar issue sin chocar con nadie.
- `/entregar` — commit, PR que cierra issue, aviso al equipo.
- `/investigar <tema>` — investigar un tema y guardar hallazgo en `docs/research/`.
- `/registrar-decision <decisión>` — agregar entrada a `docs/decisiones.md`.
- `/generar-facturas` — crear facturas simuladas + reglas de empresa ficticia en `data/`.
- `/evaluar-agente` — correr agente sobre dataset y medir autonomía / seguridad / explicabilidad.

Externas (instaladas con `npx skills`, lock en `skills-lock.json`): `shadcn`, `supabase`, `supabase-postgres-best-practices`, `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, `use-railway`, `test-driven-development` (usar en motor de reglas), `systematic-debugging`, `verification-before-completion` (correr `npm test` + `typecheck` antes de decir "listo").

MCPs: `playwright` (probar UI; usa Chrome del sistema, cada quien puede apuntarlo a su navegador en scope local, ver README), `shadcn` (componentes + registros gratis), `21st` (buscar ideas; free = 2 descargas/día, necesita `API_KEY_21ST` en la shell), `next-devtools` (errores del `next dev`), `supabase` (OAuth con la cuenta del equipo, nunca personal). Railway MCP va por persona, no en repo. Versiones de MCP fijadas: subirlas a propósito, no con `@latest`. Detalle: `docs/research/herramientas-claude-code.md`.
