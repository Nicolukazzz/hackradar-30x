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
