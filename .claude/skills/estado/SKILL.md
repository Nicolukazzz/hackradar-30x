---
name: estado
description: Ver qué está haciendo cada integrante del equipo - issues asignados, sin dueño, PRs abiertos y últimas decisiones. Usar al empezar a trabajar, antes de elegir tarea, o cuando pregunten "qué falta", "quién está en qué", "qué hago ahora".
---

1. `git fetch -q` y `gh issue list --state open --json number,title,assignees,labels,updatedAt` y `gh pr list --state open --json number,title,author,headRefName,isDraft,reviewDecision`.
2. `gh api user --jq .login` para saber quién soy.
3. Leer las 3 entradas más nuevas de `docs/decisiones.md`.
4. Responder con:
   - **En curso**: por persona, issue + rama + PR si hay.
   - **Libres**: issues sin dueño, ordenados por label `prioridad:alta` primero y luego por número.
   - **Para revisar**: PRs abiertos de otros que esperan review.
   - **Choques posibles**: issues en curso que declaran tocar los mismos archivos/carpetas.
   - **Sugerencia**: 1 issue libre para mí, con por qué.
Corto. No tomar ni modificar nada: solo leer.
