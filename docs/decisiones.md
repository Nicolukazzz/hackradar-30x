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

## 2026-10-17 — Doble lectura implementada (#58)
- Estado: propuesta
- Decisión: `LLM_PROVIDER=doble` aplica la decisión "Doble lectura LLM (Gemini + Haiku)": para los campos que el parser no resolvió, Gemini y Claude Haiku 5.5 (`src/extraccion/llm/anthropic.ts`, SDK oficial `@anthropic-ai/sdk`) leen en paralelo y `votar()` (`src/extraccion/extraer.ts`) da 0,92 solo si coinciden 2 de 3 lectores (parser, A, B; el parser no vota si marcó el campo como ambiguo); si no, ≤ 0,5 y R1 escala. Si un lector cae del todo, nada llega a 2 de 3: escala (nunca paga con una sola lectura). Sin llave de Anthropic (o de Gemini), Groq toma ese lugar; si están las tres, Groq respalda solo al primer lector (si respaldara a los dos, podría "coincidir consigo mismo"). Con un solo proveedor, cadena simple de siempre. Señales de R10 de cualquiera de los dos cuentan. Haiku 5.5 no acepta `temperature` (400) y piensa por defecto: se pide `effort: "low"`. `anthropic` también entra a la cadena simple (`LLM_PROVIDER=anthropic`). Los demás modos no cambian; el CI sigue sin llaves.
- Por qué: un dato falso (cuenta, monto) necesita que dos modelos de proveedores distintos se equivoquen igual. Costo ~USD 0,001 por factura que el parser no resuelve.
- Quién: J

## 2026-10-17 — Login abierto con correo + contraseña, sin roles (#49)
## 2026-10-17 — Aviso a aprobadores cuando el agente escala (#68)
- Estado: propuesta
- Decisión: `src/avisos/`. Después de **registrar** una `DECISION_AGENTE` con `ESCALAR` (en `procesarDocumento`, que usan correo, panel y Telegram, y en "Procesar facturas nuevas"), `avisarEscaladas` manda en segundo plano un aviso armado con plantilla desde la entrada (sin LLM): factura, beneficiario, USD, explicación §7, chips de reglas, asignada a y plazo (§10, `asignacionDe`) y enlace a la traza (`urlPublica`). Destinatarios: los miembros que hoy pueden aprobar (`firmantes()`) cuyo límite cubre el monto; sin monto confiable, todos los firmantes; si nadie lo cubre, los admins. Correo por el SMTP del buzón del equipo (`CORREO_IMAP_*`, #14) con los aprobadores en **Bcc**; Teams opcional (`TEAMS_WEBHOOK_URL`, webhook de Workflows con `{ text }`). Sin buzón ni Teams (dev, tests, CI, CLI) no se avisa; `AVISOS=0` lo apaga. Cada canal falla por su lado y queda en el log: un aviso **nunca** cambia, frena ni retrasa la decisión. Telegram (#13) no debe avisar por su cuenta: ya lo hace `procesarDocumento`.
- Por qué: el reto parte de que el proceso "depende de que una persona esté disponible"; sin aviso, una escalada esperaba hasta que alguien abriera el panel y el plazo de §10 vencía sin que nadie lo supiera. Reusar el buzón del equipo evita otra cuenta; Teams queda como en `producto.md` §5. WhatsApp al aprobador y recordatorios por vencimiento quedan fuera.
- Quién: N

## 2026-10-17 — Roles por empresa con invitaciones (#51)
- Estado: aceptada
- Decisión: el producto es para **una empresa** (Nébula) en el hackathon; se cuenta como SaaS en el pitch ("el agente que Blinka ofrece a cada cliente") y el acceso ya es por empresa para que eso sea creíble, pero beneficiarios, reglas y registro siguen siendo de una sola empresa (`data/`). Registro en `/entrar` sigue abierto, pero **una cuenta sin membresía no ve nada**: `conSesion` exige ser miembro (403 con motivo) y el panel manda a `/sin-permiso`. Tablas `empresas` (una fila `nebula`), `membresias` (rol `admin` · `aprobador` · `tesoreria`, `limite_aprobacion_usd` solo para aprobador) e `invitaciones` (hash sha256 del token, un uso, vence en 1–30 días, revocable, `correo_esperado` opcional); RLS sin acceso desde el cliente salvo leer la membresía propia. `aceptar_invitacion` (SQL, atómica, solo `service_role`) y un trigger que impide quedarse sin admin (bloquea la fila de la empresa: dos admins quitándose el rol a la vez no dejan cero) son la segunda capa de lo que valida `src/equipo/`. Permisos por ruta con `conSesion(…, { permiso })`: aprobar → admin/aprobador; reglas, equipo y reiniciar demo → admin. La doble firma usa los miembros que **hoy** pueden aprobar (corrige que la primera firma de una cuenta nunca se encontraba en `data/aprobadores.json`). Pantalla `/equipo` (solo admin, invitar en 3 pasos, cambiar rol, quitar, revocar) y `/unirse/[token]`. Primer admin: `npm run equipo:admin -- <correo>`. Las columnas `rol`, `aprobador_id`, `beneficiario_id` de `perfiles` siguen sin uso (borrarlas exige confirmación manual en Supabase; no estorban). Reemplaza la parte "sin roles" de #49; el portal de proveedores con cuenta propia queda para #28.
- Por qué: con #49 cualquiera de internet podía aprobar escalados y subir el límite automático en producción: inaceptable para el criterio de seguridad del reto aunque no se mueva dinero. Invitar por enlace evita mantener listas de correos y deja que el admin conecte a cada persona con un rol. SaaS completo (crear tu empresa, datos por empresa) se descartó para el hackathon: toca motor, repositorio, pantallas y evaluación, y un error de aislamiento entre empresas sería peor que cualquier bug actual.
- Quién: N

## 2026-10-17 — Login abierto con correo + contraseña, sin roles (#49)
- Estado: aceptada; la parte "sin roles" la reemplaza "Roles por empresa con invitaciones" (#51). El login abierto sigue.
- Decisión: `/entrar` es un login de app normal: **cualquiera crea su cuenta** (nombre, correo, contraseña ≥ 8), confirma el correo con un código de 6 dígitos y después entra con correo + contraseña; "¿Olvidaste tu contraseña?" por código. **Sin roles** por ahora: toda cuenta ve y hace todo; al aprobar o guardar reglas actúa con su propio nombre como aprobador principal sin límite (`aprobadorDeLaCuenta`), y la doble firma > USD 10.000 sigue pidiendo dos cuentas. `conRol` pasa a `conSesion`. `perfiles` queda con `nombre` y `activo` (un trigger lo crea al registrarse; `rol`/`aprobador_id`/`beneficiario_id` quedan sin uso y opcionales para no romper el deploy anterior). Se retiran `/portal`, `/api/portal/facturas`, `src/servicios/portal.ts`, la semilla `scripts/auth/` y `npm run auth:sembrar`. Reemplaza la parte de roles de #25 y la decisión de #46 (usuarios por alias) y deja sin login el portal de #12.
- Por qué: el dueño del producto quiere por ahora un portal donde la gente se registre sola, sin roles; los roles vuelven después. Riesgo aceptado (revisión de seguridad del PR #50, decidido por N): en producción cualquiera de internet puede registrarse, ver todos los documentos, aprobar escalados y guardar reglas; y una sola persona con dos correos puede dar las dos firmas de un pago > USD 10.000. Es una demo y no se mueve dinero. Lo que **no** se acepta, y se corrigió en el mismo PR: que una cuenta cualquiera haga pagar al agente sin humano. Una factura subida desde el panel lleva como remitente el correo confirmado de la cuenta (tipo `correo`, no `interno`), así que R11 solo cumple si ese correo está vinculado al beneficiario; si no, escala. `POST /api/canales/correo/simular` exige autenticación del remitente en producción sin `DEMO=1`. En el registro, quien aprueba aparece como "Nombre (correo)". Las cuentas de proveedor del #46 quedaron desactivadas. Volver a tener roles queda pendiente en #51. Los límites por aprobador siguen en `decidir.ts` para cuando vuelvan los roles. La protección contra contraseñas filtradas (HaveIBeenPwned) es solo del plan Pro de Supabase.
- Quién: N

## 2026-10-17 — Usuarios de la demo por alias del Gmail del equipo (#46)
- Estado: reemplazada por "Login abierto con correo + contraseña, sin roles" (#49), salvo el aviso de envío fallido y `API_PUBLICAS`, que siguen.
- Decisión: la semilla de Supabase Auth crea un usuario por rol con alias de `facturas.nebula.demo@gmail.com` (`+laura` aprobadora principal, `+andres` aprobador, `+tesoreria`, y 5 proveedores con portal), versionados en `scripts/auth/usuarios.equipo.json`; correos personales siguen en `scripts/auth/usuarios.json` (ignorado). `/entrar` avisa cuando el correo no se pudo enviar (5xx) pero sigue sin delatar correos no registrados (4xx). El proxy vuelve a respetar `API_PUBLICAS`. Se quitan de `permisos.ts` los helpers que duplicaban reglas del dominio (límite del aprobador, aprobador principal, documentos del proveedor).
- Por qué: con un solo usuario nadie más del equipo podía entrar ni probar el portal (#12). Un buzón compartido deja a cualquiera presentar la demo con cualquier rol, sin modo demo ni contraseñas. Una sola fuente de verdad por regla de permisos.
- Quién: N

## 2026-10-17 — Repositorio en Supabase (#44)
- Estado: propuesta
- Decisión: `REPOSITORIO=supabase` implementa la interfaz `Repositorio` (#17) en `src/repositorio/supabase.ts`. En la base vive lo que cambia: `registro` (append-only con dos capas: `service_role` solo tiene SELECT/INSERT y un trigger rechaza UPDATE, DELETE y TRUNCATE incluso al superusuario), `documentos`, `reglas_versiones`, `beneficiarios_agregados` y `secuencias` (función atómica `siguiente_secuencia` para la ref INT). Los archivos van al bucket **privado** `documentos` (`{ref}/{nombre}`). Lo fijo (empresa, 14 beneficiarios base, tasas, escenario y sus documentos) sigue en `data/`, que viaja con el deploy. Al primer arranque se siembran las versiones de reglas y el historial del escenario. RLS activado y sin acceso para `anon`/`authenticated`. Lecturas paginadas de a 1000 filas (PostgREST corta ahí: un historial a medias haría que R2 no viera un duplicado). La siembra es `ON CONFLICT DO NOTHING` (dos instancias a la vez no chocan). La exclusividad (`enExclusiva`) es dentro del proceso; si durante un deploy el contenedor viejo y el nuevo escriben a la vez, la clave única de `registro.id` hace fallar uno con error visible, nunca una decisión duplicada. `siguienteRef` reserva la ref en los dos repositorios (nunca se reutiliza).
- Contrato común: `tests/repositorio/contrato.ts` corre contra memoria en cada `npm test` y contra Supabase local con `npm run test:supabase` (Docker + CLI), incluido "después de un reinicio todo sigue ahí". La migración `20261017023935_revocar_rls_auto_enable.sql` (#25) pasa a ser condicional porque `rls_auto_enable()` no existe en un Supabase local; en el hospedado ya estaba aplicada y no cambia nada.
- Por qué: con `REPOSITORIO=memoria` cada merge a `main` redeploya y borra facturas, aprobaciones, reglas guardadas y correos recibidos; la demo no puede depender de que nadie mergee.
## 2026-10-17 — Explicaciones más cortas sin mezclar causas (#42)
- Estado: propuesta
- Decisión: R10 cita la frase que disparó el detector, tal como la escribió el proveedor (`datos.frase`, ≤ 60 caracteres), no la línea entera (`datos.fragmento` queda para resaltar en la Traza). Si R3 ya falló, R11 dice solo `el remitente ({remitente}) tampoco está vinculado.`; con remitente `interno` y R3 fallida, R11 no repite la causa. **Se mantiene una frase por regla**: no se une R11 dentro de R3 (alternativa descartada en "Remitente no vinculado: regla R11 en vez de estado CUARENTENA"). La heurística de #7 pasa de un tope fijo a un presupuesto: 280 caracteres con hasta dos causas y 60 más por causa extra.
- Por qué: OMI-3381 tenía 452 caracteres por citar entera la instrucción inyectada; ahora 325 con tres causas. El tope fijo castigaba explicar bien varias causas.
- Quién: J

## 2026-10-17 — Canal de correo (#14): IMAP dentro del proceso web
- Estado: propuesta
- Decisión: `src/canales/correo/`: `correoAEntrada` (.eml crudo → `DocumentoEntrante`: `From` como remitente, cuerpo en `texto_mensaje` para R10, adjuntos en base64, sin imágenes incrustadas de la firma) y `recibirCorreo` (ingesta #11 + respuesta `Re: …` con `textoRespuesta`). Si `Authentication-Results` trae `spf|dkim|dmarc=fail` (o softfail/permerror), el remitente queda `no-verificado:<from>`: no coincide con ningún canal, R11 escala y **no se responde** (evita escribirle a la víctima de la suplantación). Buzón real: Gmail del equipo por IMAP (`imapflow`) y SMTP (`nodemailer`) con clave de aplicación (`CORREO_IMAP_USUARIO`, `CORREO_IMAP_CLAVE`); `src/instrumentation.ts` arranca un sondeo cada 60 s **dentro del proceso web**, porque el repositorio en memoria vive ahí (un worker aparte no vería los mismos datos). Lo procesado se marca con la etiqueta de Gmail `blinka-procesado` **antes** de procesar (como mucho una vez, aunque el proceso se reinicie), no con `\Seen`: una persona puede leer el buzón sin que se pierdan facturas. **Buzón real exige `dmarc=pass`** (SPF/DKIM pueden pasar para otro dominio); sin eso el remitente queda no verificado y R11 escala. Rebotes, `Auto-Submitted`, `Precedence: bulk`, remitentes de sistema y lo que manda el propio buzón se ignoran (sin bucles); las respuestas llevan `Auto-Submitted: auto-replied`. Los adjuntos pasan por `validarArchivo` (#26). El cliente IMAP tiene listener de `error` (sin él un corte de red tumba el proceso). Demo sin internet: `POST /api/canales/correo/simular` (panel) con el .eml en el cuerpo. Enlaces de los avisos con `urlPublica()` (`RAILWAY_PUBLIC_DOMAIN`), nunca de cabeceras de la petición.
- Por qué: el issue prefería webhook (Postmark/Cloudflare), pero el equipo ya tiene el Gmail con clave de aplicación en Railway y no hace falta otra cuenta ni dominio. Con el repositorio Supabase, el sondeo podrá pasar a un servicio aparte.
- Quién: J
## 2026-10-16 — Doble lectura LLM (Gemini + Haiku) y canal de chat WhatsApp
- Estado: propuesta (falta que N y S la acepten en el PR)
- Decisión: (1) **Doble lectura**: cuando el parser sin IA no resuelve un campo obligatorio, se llama a Gemini Flash y a Claude Haiku 5.5 en paralelo, ambos solo para los campos faltantes, y se cruzan con el parser: un campo queda con confianza ≥ 0,90 solo si al menos 2 de los 3 lectores coinciden; si no, ≤ 0,5 y R1 escala. Señales de R10 de cualquiera de los dos cuentan. Groq queda de respaldo si uno falla. Reemplaza "Gemini → Groq → Haiku opcional" de `producto.md` §4. (2) **Canales**: WhatsApp Cloud API como chat de proveedores en lugar de Telegram (vinculación con token de un solo uso desde el portal), Teams solo como aviso interno a aprobadores (webhook de Workflows) y Telegram como plan B. Correo: Gmail del equipo por IMAP. Siguen siendo 3 canales de entrada.
- Por qué: un solo LLM puede leer mal o ser engañado por la factura sin que nadie lo note; con 2 de 3 un dato falso necesita que dos lectores independientes se equivoquen igual. Haiku cuesta ~USD 0,001 por factura y solo corre en las que el parser no resuelve. WhatsApp y Teams son lo que usan las empresas de referencia; Telegram casi no.
- Impacto: #4 (extracción) suma el lector Haiku y el cruce 2 de 3 (issue nuevo); #13 pasa a WhatsApp; #14 usa IMAP; `.env.example` suma las variables. Nada cambia en el motor: la decisión sigue siendo código.

## 2026-10-16 — Portal de proveedores (#12) sobre el login de #25
- Estado: propuesta
- Decisión: `/portal` usa el login OTP de Supabase (rol `proveedor`, `beneficiario_id` en `perfiles`), no la cookie demo `PORTAL_SECRET` que pedía el issue (el modo demo se quitó en #25). Una sola página: "Envía una factura" (`SubirDocumento` → `POST /api/documentos`, #26) y "Tus facturas" (`facturasDelProveedor` en `src/servicios/portal.ts`, también `GET /api/portal/facturas`). El proveedor ve solo documentos cuyo remitente está vinculado a su beneficiario (`beneficiario_remitente_id` de la sesión, nunca de la petición), con 4 estados (aprobada · en revisión · no se pagará · no es factura) y textos de `respuesta.ts`; la decisión humana reemplaza la del agente con un texto fijo (el comentario del aprobador es interno). Vincular Telegram queda para #13, pendiente de decidir el canal de chat.
- Por qué: una sola identidad (Supabase) para panel y portal; el filtro por sesión impide ver facturas ajenas aunque se manipule la URL.
- Quién: J

## 2026-10-16 — Subida segura (#26) y todas las rutas de API con `conRol`
- Estado: propuesta
- Decisión: `POST /api/documentos` (multipart, campo `archivo`, un archivo) para portal (proveedor) y panel (tesorería/aprobador, canal `carga_manual`, remitente `interno` = correo de la sesión). El tipo se decide por magic bytes (`src/ingesta/validar-archivo.ts`: PDF, PNG, JPG, XML; PDF cifrado o sin páginas → 422; > 10 MB → 413, cortando el cuerpo al pasar el límite; otro tipo → 415). El remitente del proveedor sale de la sesión (`portal_usuario` de su beneficiario), nunca del cuerpo. Se guarda como `{sha256}.{ext}`; el nombre original queda saneado como metadato del adjunto. 20 subidas/min por usuario (en memoria del proceso). Entra por `ingerir` + `procesarDocumento` (#11). Componente `SubirDocumento` en `src/components/subir-documento.tsx` (lo montan #12 y #6).
- Rutas: todas las de `src/app/api/**` pasan por `conRol` (el test de arquitectura vuelve a ser estricto). Panel (`tesoreria`, `aprobador`): bandeja, facturas, registro y exportes, reglas GET, simular, procesar, evaluar, aprobaciones GET, reiniciar demo. Solo `aprobador`: decidir y guardar reglas; quién decide sale de `sesion.aprobador_id` (`aprobadorDeLaSesion`). Archivo original: panel, o el proveedor dueño (subido por él por el portal); para el resto 404. XML y otros tipos se descargan (`attachment`), PDF/imagen se muestran con CSP. Se elimina `POST /api/demo/actuar-como` y la cookie `actuar_como` (coherente con #25, que quitó el modo demo).
- Portal sin `portal_usuario`: el remitente es el id del beneficiario de la sesión; `beneficiarioDelRemitente` y **R11** aceptan para `tipo: "portal"` el usuario de portal o el id del beneficiario (solo el servidor pone ese remitente, desde la sesión). Si el registro falla después de ingerir, se reintenta una vez y si no, 503 con la ref. `experimental.proxyClientMaxBodySize = "11mb"`: con proxy, Next corta el cuerpo en 10 MB por defecto.
- Pendiente cuando exista el repositorio Supabase: bucket privado `documentos/{ref}/{sha256}.{ext}` con URL firmada de 5 min. Con `REPOSITORIO=memoria` los archivos viven en memoria del proceso y se sirven solo por la ruta protegida.
- Por qué: un solo camino para archivos evita que cada canal valide distinto, y sin `conRol` un proveedor logueado podía leer el registro de todos y llamar a `/api/procesar`.
- Quién: J

## 2026-10-16 — Ingesta única (#11): contrato para los canales
- Estado: propuesta
- Decisión: todo canal llama a `ingerir(entrada: DocumentoEntrante, { repo, reloj, dirBase?, original? })` (`src/ingesta/ingerir.ts`: zod, sha256 del adjunto principal o del texto, formato por canal/mime, ref `INT-AAAA-NNNNNN` reservada en exclusiva, remitente→beneficiario con correo exacto en minúsculas) y después a `procesarDocumento(ref, { repo, ahora, extractor })` (`src/ingesta/pipeline.ts`), que devuelve la `EntradaRegistro` para responder con `textoRespuesta(entrada, idioma, { urlPortal })` (`src/ingesta/respuesta.ts`). El extractor se inyecta: `extractorReal(deps)` (#4) o `extractorGolden(id)` (demo sin LLM, por hash). La decisión pasa por `procesarLote` con un lote de uno, así presupuesto, ids y momento son los mismos que en "Procesar facturas nuevas".
- Archivo repetido (§8 paso 3): si el mismo sha256 ya está pagado, aprobado o esperando aprobación, **no se vuelve a extraer**: se reusa la extracción guardada en la entrada previa (mismo archivo ⇒ mismos datos) y R2 frena por "mismo archivo". Si la previa no guardó extracción (historial importado) se arma una mínima con emisor y número. **Cambio en R2** (`src/reglas/r02-duplicado.ts`, §4.3): el criterio "mismo archivo" se evalúa antes de exigir un nombre legible, así el reenvío de una factura ilegible frena en vez de escalar y reservar dos veces. Si el extractor falla, el documento recibe una extracción vacía y R1 escala: nunca queda sin decisión. Si falla R11, la respuesta no confirma el número de factura (posible suplantación). Así el FRENAR sale del motor y de sus plantillas, no de un atajo escrito a mano.
- Respuesta al proveedor: estado + ref; FRENAR solo dice "factura repetida" (R2) o "no coincide con lo acordado" (R5); R6/R7 (máximo, presupuesto) se reportan como "finanzas te contactará". Nunca límites, montos de la empresa ni ids de reglas (test con es/en/pt sobre los 26 documentos). R11 agrega el enlace para vincular el canal.
- `cargarGolden` usa `recibir()` de la ingesta: golden y canales producen el mismo `DocumentoRecibido`. `crearRepositorioMemoria(id, dir, { lote: "vacio" })` carga solo historial y configuración para que los documentos entren por la ingesta (refs desde 000001). `POST /api/procesar` sigue con el lote golden (#17) y `POST /api/ingesta` queda para el portal (#12/#26), que debe tomar el remitente de la sesión, nunca del cuerpo.
- Por qué: un solo punto de entrada evita que cada canal calcule distinto el hash, la ref o el remitente (R2 y R11 dependen de eso), y reusar la extracción ahorra LLM sin saltarse el motor.
- Quién: J

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
