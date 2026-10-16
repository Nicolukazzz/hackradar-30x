---
name: registrar-decision
description: Agregar o actualizar una decisión del equipo en docs/decisiones.md. Usar cuando el equipo decide reto, stack, arquitectura, alcance o descarta una idea.
argument-hint: <decisión>
---

Decisión: $ARGUMENTS

1. Leer `docs/decisiones.md`. Si ya hay una entrada sobre lo mismo, actualizar su estado (`reemplazada por ...`) en vez de duplicar.
2. Insertar entrada nueva **arriba** (debajo de `---`), con formato del archivo: fecha de hoy, Estado, Decisión, Por qué (incluye alternativas descartadas), Quién.
3. Si la decisión cambia algo de `CLAUDE.md` (reto elegido, stack, comandos, invariantes), actualizar `CLAUDE.md` en la misma pasada. Mantenerlo corto.
4. Mostrar diff y sugerir commit: `docs: decisión <título>`.
