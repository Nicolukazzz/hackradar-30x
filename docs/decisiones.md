# Registro de decisiones

Una entrada por decisión, la más nueva arriba. Formato:

```
## AAAA-MM-DD — Título corto
- Estado: propuesta | aceptada | descartada | reemplazada por <título>
- Decisión: qué se decidió.
- Por qué: razones, alternativas consideradas.
- Quién: iniciales.
```

---

## 2026-10-16 — Evaluación (#7): un solo `ReporteEvaluacion` para CLI, CI y "Simular"
- Estado: propuesta
- Decisión: `evaluarEscenario(id, { extraccion: 'golden'|'real', reglas?, repo?, motor? })` en `src/evaluacion/evaluar.ts`; `POST /api/reglas/simular` la llama con el repositorio (`repo`) en vez de armar el lote a mano. El reporte **mantiene la forma que ya consumía la API (#17)**: `pagos_indebidos` y `escalados_innecesarios` son conteos y el detalle sale de `documentos` (helpers `pagosIndebidos()`/`escaladosInnecesarios()`), en vez de las listas que proponía el issue; se agregan `escenario`, `modo`, `matriz` 4×4, `por_trampa` (sin trampa = `normal`), `explicabilidad` y, por documento, `documento`, `trampa`, `explicacion` y `problemas`. Heurística de explicabilidad (`explicabilidad.ts`): nombra cada regla fallida (id, nombre del catálogo o la frase de su plantilla §7, p. ej. "no está vinculado" = R11), trae cifras si la comparación es numérica (R5–R9 y PAGAR), sin jerga (`null`, `undefined`, `NaN`, `true/false`, `[object`, `R9:` suelto) y ≤ 280 caracteres. CLI `npm run evaluar` (`--escenario`/`--todos`, `--sin-informe`): resumen con seguridad primero, informe `docs/research/eval-AAAA-MM-DD-HHMM.md`, exit 1 si hay pagos indebidos; el CI corre `--todos --extraccion golden --sin-informe`. Modo `real` usa `extraer` (#4) sobre el mismo `DocumentoRecibido` del golden hasta que exista `ingerir` (#11).
- Hallazgo: la heurística marca OMI-3381 (452 caracteres) y F-0110 (320) por largas: el fragmento inyectado se cita completo. Queda para quien toque `src/reglas/explicar.ts` (recortar el fragmento citado), no se cambia en #7.
- Por qué: cambiar `pagos_indebidos` a lista rompía la pantalla Reglas (#6e) y `POST /api/reglas` sin aportar nada que `documentos` no tenga. Una sola función para CLI, CI y simulación garantiza que la pantalla muestre los mismos números que el CI.
- Quién: J

## 2026-10-16 — Autenticación: Supabase Auth con OTP por correo, sin JWT propio (#25)
- Estado: propuesta
- Decisión: el login es **Supabase Auth** con código OTP de 6 dígitos por correo (`signInWithOtp` con `shouldCreateUser:false`). No hay JWT propio, ni `jose`, ni `AUTH_JWT_SECRET`, ni `data/usuarios.json`. La identidad y el rol salen de la sesión: en el servidor `obtenerSesion()` (`src/lib/auth/sesion.ts`) valida el token con `getClaims()` y lee el rol de `public.perfiles` (RLS) con cliente admin; el rol **nunca** vive en `user_metadata`. Toda ruta protegida pasa por la misma puerta `conRol` (`src/lib/auth/ruta.ts`, sobre `crearGuardia` en `guardia.ts`): 401 sin sesión, 403 por rol, CSRF por `Origin` y auditoría inyectable, con los textos de `permisos.ts` (`MENSAJE_401/403`). `src/proxy.ts` refresca la sesión y corta `/api/*` sin sesión con 401 antes de llegar a la ruta; el actor que aprueba sale de la sesión, no del cuerpo. Se elimina por completo el modo demo (botones "Entrar como…", `DEMO_LOGIN`/`DEMO_PASSWORD`, `src/lib/auth/usuarios-demo.ts`). El SMTP de Supabase apunta a Gmail (`facturas.nebula.demo@gmail.com`).
- Por qué: los proveedores de correo free no sirven para varios destinatarios (Resend free solo entrega al dueño de la cuenta → `403 validation_error`), y mantener contraseñas/JWT propios agrega superficie y trabajo sin aportar al reto. Fuente única de identidad (Supabase) + rol en tabla con RLS = menos código de seguridad que sostener y un solo lugar donde mirar permisos. OTP sin contraseña encaja con "el proveedor entra desde el correo".
- Quién: N

## 2026-10-16 — API (#17): repositorio en memoria, servicios compartidos con la UI e identidad en una sola función
- Estado: propuesta
- Decisión: las rutas de §12 (`src/app/api/**`) solo validan con zod y llaman a `src/servicios/*` (arman cada respuesta) o a `src/aprobaciones/decidir.ts` (§10). Los Server Components de las pantallas usan **los mismos servicios** vía `src/app/_datos/*` en vez de pedirse HTTP a sí mismos: una sola forma de respuesta y ningún import de `src/reglas` desde la UI. Persistencia detrás de `Repositorio` (`src/repositorio/`): en memoria por defecto (`ESCENARIO=lote-demo-oct`, reiniciable con `POST /api/demo/reiniciar`), Supabase queda como stub. `POST /api/procesar` corre el motor sobre los documentos pendientes con extracción golden por defecto (`EXTRACCION=real` usa #4). Quién aprueba sale de `aprobadorDeLaPeticion()` (`src/app/api/_identidad.ts`), que hoy lee la cookie demo `actuar_como` y que #25 reemplaza por `exigirRol`; el body con `aprobador_id` se rechaza (400). `asignado_a` y `responder_antes_de` no se guardan en el registro: se recalculan con `asignarAprobador`/`responderAntesDe` del motor. Formas de respuesta y ejemplos reales en `docs/api-ejemplos.md` (incluye `TarjetaAprobacion`, que no estaba en §3).
- Detalles de §10 que fija el código: el límite del aprobador se exige al aprobar, no al rechazar (rechazar nunca paga); una factura sin monto confiable no se puede aprobar (409); `POST /api/reglas` solo para el aprobador principal y rechaza (409) una versión cuya simulación aprobaría pagos fuera de reglas. Entradas de configuración (`CAMBIO_REGLAS`) usan `ref_interna` `CONFIG-REGLAS-Vn` y canal `carga_manual` porque §9 exige esos campos.
- Por qué: #6 necesita datos reales y un recorrido de demo con estado (aprobar → registro → simulación), imposible con mocks. Compartir servicios evita que API y pantallas diverjan; una sola función de identidad deja a #25 un cambio de un archivo.
- Quién: J

## 2026-10-16 — Motor de reglas R1–R11 implementado (#5)
- Estado: propuesta
- Decisión: `src/reglas/` (una regla por archivo, `evaluarFactura`, `procesarLote`, presupuesto, explicaciones) y `src/registro/registro.ts` (solo crear entradas). Reproduce el lote demo (5/3/4, disponible final 2.277,30) y las 14 trampas de noviembre con `extraccion_esperada`. Ajustes al contrato en especificación §16 punto 7: detector R10 vive en `src/reglas/inyeccion.ts` (el motor no importa `src/extraccion`; #4 puede re-exportarlo), try/catch por regla y global → ESCALAR, guardas extra para PAGAR (R6/R7/R9 CUMPLE y monto no nulo), USD que redondea a 0 cuenta como monto no confiable, `momento` de la entrada = `recibido_en`, explicaciones nombran al beneficiario y ESCALAR dice cuánto reserva.
- Por qué: el motor tiene que defenderse solo aunque el extractor falle o lo engañen. Los invariantes de §5 corren con 10.000 facturas aleatorias (fast-check) y encontraron un caso real (COP 1 → USD 0,00 se pagaba). Nombrar al beneficiario y el monto en cada explicación cumple el criterio de explicabilidad sin abrir la traza.
- Quién: N

## 2026-10-16 — Extracción: parser por etiquetas primero, LLM solo para faltantes (#4)
- Estado: propuesta
- Decisión: `src/extraccion/` expone `extraer(doc: DocumentoRecibido, { llm, cache?, dirBase?, confianzaMinima? }): Promise<Extraccion>` (lo usan #11 y #7), `detectarInstrucciones(texto)` para R10 (#5) y `proveedorDesdeEntorno()` para elegir LLM. Parser sin IA por etiquetas ES/EN/PT (PDF con `unpdf`, `.eml` crudo con `mailparser`, chat, XML CFDI/UBL): 0,99 con etiqueta, 0,6 inferido. Solo si un obligatorio queda < 0,90 se llama al LLM (Gemini → Groq → ninguno, REST sin SDK) y solo para esos campos; si parser y LLM discrepan la confianza baja a ≤ 0,5 (R1 escala); lo mismo entre fuentes del mismo documento (XML, PDF y cuerpo del correo: "cambiamos de cuenta" en el cuerpo con otra cuenta en el PDF escala). Un adjunto ilegible no lanza: deja campos vacíos y R1 escala. Respuesta del LLM validada con zod: si no valida, se descarta entera. La caché (`.cache/extraccion/`) guarda solo la respuesta del LLM por hash de lo enviado; `texto_crudo` siempre se recalcula, para que R10 nunca vea el cuerpo de otro correo. Anthropic queda sin implementar (opcional). Sin LLM, los 24 documentos PDF/EML/TXT del dataset extraen igual a `extraccion_esperada`.
- Por qué: presupuesto $0 (los PDFs del dataset no necesitan IA) y seguridad: el LLM no puede pisar un campo que el parser ya leyó con etiqueta ni subir una confianza en contra del parser.
- Quién: J

## 2026-10-16 — Contrato del dominio en código (#2)
- Estado: aceptada (#9): aplicada en `src/dominio/`, PR #22 mergeado.
- Decisión: el contrato de §3 y §9 vive en `src/dominio/`: `tipos.ts` (tipos escritos a mano, incluidos los del dataset: `MetaDocumento`, `ExtraccionPlana`, `EsperadoDocumento`, `ConfigEscenario`, `Trampa`) y `esquemas.ts` (zod estricto; un test de compilación exige que cada esquema produzca exactamente su tipo). Interfaz entre módulos: `cargarDatosComunes()` y `cargarEscenario(id)` (`cargar.ts`, valida todo `data/`, documentos en orden de llegada por instante real), `aUsd`/`formatear*`/`porcentaje` (`dinero.ts`), `normalizarNombre`/`normalizarNumeroFactura` (`normalizar.ts`), `Reloj` + `relojFijo` (`reloj.ts`). El reloj real (`relojSistema`) va en `src/lib/reloj-sistema.ts` porque el lint prohíbe leer la hora en el dominio. Invariantes en los datos: R9 ≤ R6, solo R5/R8 desactivables, tasas > 0, canales únicos por beneficiario, un aprobador principal, cada documento con exactamente una respuesta esperada.
- Por qué: #4, #5, #7, #11 y #17 dependen de estos nombres; con tipos y esquemas atados en compilación no pueden desincronizarse. La paridad con el generador Python (mismos USD, tasa y normalización) se verifica en los tests.
- Quién: J

## 2026-10-16 — Reglas de UI: componentes primero, estilo premium
- Estado: aceptada
- Decisión: antes de escribir UI se busca el componente (MCP `shadcn` con registros gratis `@react-bits`, `@skiper-ui`, `@magicui`, `@aceternity`, `@kibo-ui`; MCP `21st`). Estilo profesional premium tipo Apple, Geist sin cursiva, interacción por pasos (máx. 3–5 campos visibles), nada de formularios largos. Reglas completas en `CLAUDE.md` "Reglas de UI".
- Por qué: menos tiempo en UI, aspecto consistente y una demo que transmita confianza en un producto de pagos.
- Quién: N

## 2026-10-16 — Infra: Railway Hobby + Supabase en cuenta del equipo
- Estado: aceptada
- Decisión: deploy en Railway plan Hobby (USD 5/mes, proyecto `hackradar-30x`, dueño N; el resto se invita). Persistencia de deploy en Supabase free, en una cuenta creada para el equipo con un correo dedicado, nunca en cuentas personales. MCP `supabase` del repo se autentica por OAuth con esa cuenta.
- Por qué: Railway da URL pública estable para webhooks de Telegram y correo sin apagarse en la demo. Supabase aporta auth por enlace mágico y storage para el portal de proveedores, que Postgres solo de Railway no da. Cuenta separada para no mezclar con proyectos personales.
- Quién: N

## 2026-10-16 — Dataset v1 generado y verificado (#3)
- Estado: aceptada (#9): aplicada en `data/` y `scripts/dataset/`, PR #18 y #19 mergeados.
- Decisión: `data/` completo (comunes + `lote-demo-oct` + `trampas-extra`) lo genera `scripts/dataset/generar.py` desde `mundo.py` y `escenarios.py`; nadie edita `data/` a mano. Cada decisión esperada se escribe a mano y la recalcula un oráculo independiente (`oraculo.py`); el generador falla si no coinciden o si la aritmética del lote demo no da la del prototipo. Ajustes de especificación que salieron de construirlo (§4.3, §10, §11, §16 punto 6): campos afectados por R1 → reglas dependientes NO_APLICA; hitos repetidos sin ventana; doble aprobación con al menos una firma con límite suficiente; trampa nueva `fecha-invalida`; líneas `VR-SOP` y `OC-126`; `.meta.json` con `archivo_original` y adjuntos extraídos.
- Por qué: una sola fuente evita que el JSON de proveedores y los documentos digan cosas distintas; el oráculo garantiza que cada `esperado.json` sea inequívoco antes de que el motor (#5) lo use como verdad. Los JSON comunes (que #2 iba a escribir) salen del mismo generador; #2 se queda con tipos, zod y cargador.
- Quién: J

## 2026-10-16 — Especificación v1 como contrato técnico
- Estado: aceptada (#9): base de #1, #2 y #3, ya mergeados.
- Decisión: `docs/especificacion.md` es la fuente de verdad para escribir código: tipos compartidos (§3), reglas R1–R11 con lógica exacta (§4), combinación e invariantes (§5), presupuesto (§6), plantillas de explicación (§7), registro (§9), aprobaciones (§10), dataset (§11), API (§12), pantallas (§13) y evaluación (§14). Base visual: prototipo `docs/diseno/prototipo-ui.html`. Los issues #1–#14 citan sus secciones y traen un prompt listo.
- Por qué: con 3 personas y 3 agentes trabajando en paralelo, un contrato único evita que cada uno invente tipos, nombres de reglas o formatos distintos. El prototipo ya fijaba reglas, números y textos; la especificación los vuelve verificables (la aritmética del lote demo está comprobada en código).
- Quién: J

## 2026-10-16 — Remitente no vinculado: regla R11 en vez de estado CUARENTENA
- Estado: aceptada (#9): usada por el dataset (TD-001, OMI-3381, INV-2245); el motor (#5) la implementa.
- Decisión: agregar R11 "Remitente verificado" (escala si falla, siempre activa). Un documento de un remitente no vinculado al beneficiario que nombra la factura se procesa y se ESCALA con explicación, en vez de quedar en un estado aparte. El proveedor igual recibe "vincula tu cuenta". Ajusta la entrada "Canales y reparto LLM/código" (el resto sigue igual).
- Por qué: el prototipo muestra facturas de remitentes nuevos (TD-001, OMI-3381) escaladas con traza; un estado aparte quedaba sin explicación ni reglas. Además cubre la suplantación: una factura "de CloudNorte" enviada desde un correo que no es de CloudNorte. Alternativa descartada: meterlo dentro de R3 (mezcla dos causas en una sola explicación).
- Quién: J

## 2026-10-16 — Dataset por escenarios
- Estado: aceptada (#9): `lote-demo-oct` y `trampas-extra` en `data/escenarios/`.
- Decisión: datos comunes en `data/` (`empresa.json`, `aprobadores.json`, `proveedores.json`, `reglas/vN.json`, `tasas/AAAA-MM.json`) y cada escenario en `data/escenarios/<id>/` con `escenario.json`, `historial.json`, `documentos/` y `esperado.json`. Escenarios v1: `lote-demo-oct` (las 12 facturas del prototipo, resultado 5 pagadas / 3 frenadas / 4 escaladas) y `trampas-extra` (periodo nuevo, 12 trampas restantes). `esperado.json` incluye `extraccion_esperada` para evaluar el motor sin LLM. Reemplaza el layout plano de `data/README.md`.
- Por qué: las trampas comparten un presupuesto; mezclarlas en un solo lote hace que R7 tape las demás causas. Escenarios separados dan resultados inequívocos y permiten evaluar extracción y motor por separado.
- Quién: J

## 2026-10-16 — Dinero en centavos, tasas fijas por periodo, reloj inyectado
- Estado: aceptada (#9): `src/dominio/dinero.ts` y `reloj.ts`; lint y test de arquitectura prohíben leer la hora en el dominio.
- Decisión: montos como enteros en centavos + moneda; conversión a USD con tabla fija por periodo (`decimal.js`, redondeo half-up) y la tasa usada queda en el registro; el motor recibe `ahora` como dato y no lee reloj, red ni disco.
- Por qué: los floats rompen comparaciones de límites ("2.999,999 ≤ 3.000"); tasas fijas hacen reproducible la decisión; reloj inyectado hace los tests y la evaluación deterministas.
- Quién: J

## 2026-10-16 — Stack propuesto
- Estado: aceptada (#1). Versiones reales: Next.js 16.4.2, React 19.3, Tailwind v4, shadcn/ui `base-nova` (Base UI), Vitest 5, zod 4. `cacheComponents` apagado para mantener el renderizado dinámico clásico.
- Decisión: Next.js App Router + TypeScript estricto + Vitest + fast-check; persistencia detrás de interfaz `Repositorio` (memoria/JSON para tests y demo local, Supabase free para deploy); generador de dataset en Python (reportlab + Pillow). Carpetas y comandos en especificación §2.
- Por qué: una sola app para portal, panel y API (como proponía `producto.md` §9); el motor queda como código puro independiente del framework, así la evaluación corre sin base de datos ni LLM.
- Quién: J

## 2026-10-16 — LLM con presupuesto cero
- Estado: aceptada (#9): en implementación en #4 (Gemini → Groq). Sigue abierto si se ponen USD 5 para Claude Haiku 5.5.
- Decisión: no pagar API. Primero parseo sin IA (XML de factura electrónica, texto de PDF, caché por hash). LLM detrás de una interfaz: Gemini Flash free tier como principal, Groq free tier como respaldo, Claude Haiku 5.5 opcional si hay $5 o créditos. Explicaciones con plantillas.
- Por qué: Claude Pro no incluye acceso a la API. Como la decisión la toma el código, un modelo más barato no afecta la seguridad, solo la extracción (y la baja confianza termina en ESCALAR).
- Quién: N

## 2026-10-16 — Canales y reparto LLM/código
- Estado: aceptada (#9) con el ajuste de R11: remitente no vinculado se escala por regla, no queda en CUARENTENA.
- Decisión: entrada solo por correo, Telegram y portal web, todos a una ingesta común. Bots = adaptadores de código. El LLM (Claude) clasifica, extrae y explica; el motor de reglas en código decide. Se descarta "un LLM que decide si se paga".
- Por qué: un pago indebido descalifica, hay riesgo de prompt injection en las facturas y el reto exige explicabilidad. Basado en el proceso real de una empresa de referencia (portal → digitador → registro interno → tesorería). Ver `docs/producto.md`.
- Quién: N

## 2026-10-16 — Coordinación vía GitHub Issues
- Estado: aceptada
- Decisión: issues de GitHub = fuente de verdad de quién hace qué. Hook SessionStart muestra estado a cada agente; skills `/estado`, `/tomar-tarea`, `/entregar`. Mensajes entre agentes de distintas personas = comentarios en issues.
- Por qué: agent teams y cross-session messaging de Claude Code solo funcionan dentro de una máquina/usuario; Claude Projects no conecta con Claude Code y requiere plan Team. GitHub ya es compartido. Ver `docs/research/coordinacion-equipo.md`.
- Quién: N

## 2026-10-16 — Reto elegido: Blinka
- Estado: aceptada
- Decisión: trabajar el reto Blinka (agente que decide pagos de facturas).
- Por qué: decisión del equipo.
- Quién: N

## 2026-10-16 — Stack sin definir
- Estado: reemplazada por "Stack propuesto"
- Decisión: no fijar stack hasta cerrar reto.
- Por qué: aún en fase de investigación.
- Quién: N

## 2026-10-16 — Reto candidato: Blinka
- Estado: reemplazada por "Reto elegido: Blinka"
- Decisión: investigar primero reto Blinka (pago automático de facturas). Otros 3 retos documentados en `docs/retos/` por si se cambia.
- Por qué: interés del equipo; alcance acotado (no mueve dinero real), criterios claros (autonomía, seguridad, explicabilidad).
- Quién: N
