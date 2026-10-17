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
- Estado: propuesta
- Decisión: no fijar stack hasta cerrar reto.
- Por qué: aún en fase de investigación.
- Quién: N

## 2026-10-16 — Reto candidato: Blinka
- Estado: reemplazada por "Reto elegido: Blinka"
- Decisión: investigar primero reto Blinka (pago automático de facturas). Otros 3 retos documentados en `docs/retos/` por si se cambia.
- Por qué: interés del equipo; alcance acotado (no mueve dinero real), criterios claros (autonomía, seguridad, explicabilidad).
- Quién: N
