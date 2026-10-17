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

## 2026-10-16 — Especificación v1 como contrato técnico
- Estado: propuesta
- Decisión: `docs/especificacion.md` es la fuente de verdad para escribir código: tipos compartidos (§3), reglas R1–R11 con lógica exacta (§4), combinación e invariantes (§5), presupuesto (§6), plantillas de explicación (§7), registro (§9), aprobaciones (§10), dataset (§11), API (§12), pantallas (§13) y evaluación (§14). Base visual: prototipo `docs/diseno/prototipo-ui.html`. Los issues #1–#14 citan sus secciones y traen un prompt listo.
- Por qué: con 3 personas y 3 agentes trabajando en paralelo, un contrato único evita que cada uno invente tipos, nombres de reglas o formatos distintos. El prototipo ya fijaba reglas, números y textos; la especificación los vuelve verificables (la aritmética del lote demo está comprobada en código).
- Quién: J

## 2026-10-16 — Remitente no vinculado: regla R11 en vez de estado CUARENTENA
- Estado: propuesta
- Decisión: agregar R11 "Remitente verificado" (escala si falla, siempre activa). Un documento de un remitente no vinculado al beneficiario que nombra la factura se procesa y se ESCALA con explicación, en vez de quedar en un estado aparte. El proveedor igual recibe "vincula tu cuenta". Ajusta la entrada "Canales y reparto LLM/código" (el resto sigue igual).
- Por qué: el prototipo muestra facturas de remitentes nuevos (TD-001, OMI-3381) escaladas con traza; un estado aparte quedaba sin explicación ni reglas. Además cubre la suplantación: una factura "de CloudNorte" enviada desde un correo que no es de CloudNorte. Alternativa descartada: meterlo dentro de R3 (mezcla dos causas en una sola explicación).
- Quién: J

## 2026-10-16 — Dataset por escenarios
- Estado: propuesta
- Decisión: datos comunes en `data/` (`empresa.json`, `aprobadores.json`, `proveedores.json`, `reglas/vN.json`, `tasas/AAAA-MM.json`) y cada escenario en `data/escenarios/<id>/` con `escenario.json`, `historial.json`, `documentos/` y `esperado.json`. Escenarios v1: `lote-demo-oct` (las 12 facturas del prototipo, resultado 5 pagadas / 3 frenadas / 4 escaladas) y `trampas-extra` (periodo nuevo, 12 trampas restantes). `esperado.json` incluye `extraccion_esperada` para evaluar el motor sin LLM. Reemplaza el layout plano de `data/README.md`.
- Por qué: las trampas comparten un presupuesto; mezclarlas en un solo lote hace que R7 tape las demás causas. Escenarios separados dan resultados inequívocos y permiten evaluar extracción y motor por separado.
- Quién: J

## 2026-10-16 — Dinero en centavos, tasas fijas por periodo, reloj inyectado
- Estado: propuesta
- Decisión: montos como enteros en centavos + moneda; conversión a USD con tabla fija por periodo (`decimal.js`, redondeo half-up) y la tasa usada queda en el registro; el motor recibe `ahora` como dato y no lee reloj, red ni disco.
- Por qué: los floats rompen comparaciones de límites ("2.999,999 ≤ 3.000"); tasas fijas hacen reproducible la decisión; reloj inyectado hace los tests y la evaluación deterministas.
- Quién: J

## 2026-10-16 — Stack propuesto
- Estado: propuesta (se acepta en #1)
- Decisión: Next.js App Router + TypeScript estricto + Vitest + fast-check; persistencia detrás de interfaz `Repositorio` (memoria/JSON para tests y demo local, Supabase free para deploy); generador de dataset en Python (reportlab + Pillow). Carpetas y comandos en especificación §2.
- Por qué: una sola app para portal, panel y API (como proponía `producto.md` §9); el motor queda como código puro independiente del framework, así la evaluación corre sin base de datos ni LLM.
- Quién: J

## 2026-10-16 — LLM con presupuesto cero
- Estado: propuesta
- Decisión: no pagar API. Primero parseo sin IA (XML de factura electrónica, texto de PDF, caché por hash). LLM detrás de una interfaz: Gemini Flash free tier como principal, Groq free tier como respaldo, Claude Haiku 5.5 opcional si hay $5 o créditos. Explicaciones con plantillas.
- Por qué: Claude Pro no incluye acceso a la API. Como la decisión la toma el código, un modelo más barato no afecta la seguridad, solo la extracción (y la baja confianza termina en ESCALAR).
- Quién: N

## 2026-10-16 — Canales y reparto LLM/código
- Estado: propuesta
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
