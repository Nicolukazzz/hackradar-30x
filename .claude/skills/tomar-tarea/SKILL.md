---
name: tomar-tarea
description: Reclamar un issue de GitHub para trabajarlo sin chocar con el equipo - verifica que esté libre, se asigna, crea rama y avisa en el issue. Usar cuando digan "tomo el #n", "empiezo con X", "voy a hacer X". Si la tarea no tiene issue, lo crea.
argument-hint: "<#número | descripción de tarea nueva>"
---

Tarea: $ARGUMENTS

1. `gh api user --jq .login` = yo.
2. Si es descripción sin número: buscar issue parecido abierto (`gh issue list --search "<palabras>"`). Si existe, usar ese. Si no, crear con `gh issue create` usando plantilla de `.github/ISSUE_TEMPLATE/tarea.md` (qué, criterio de terminado, archivos/carpetas que toca, label `area:*`).
3. `gh issue view <n> --json assignees,state,title,body`:
   - Asignado a otra persona: **parar**. Decir quién lo tiene y proponer comentar en el issue o elegir otro (`/estado`). No reasignar nunca a otra persona.
   - Cerrado: parar y avisar.
4. Revisar choques: otros issues en curso que toquen los mismos archivos/carpetas. Si hay, avisar antes de seguir.
5. `gh issue edit <n> --add-assignee @me`.
6. `git switch main && git pull -q && git switch -c <tipo>/<n>-<slug-corto>` (tipo: feat, fix, docs, chore).
7. `gh issue comment <n> --body "Tomado por @<yo>. Rama: <rama>. Plan: <2-3 bullets>."`
8. Resumir plan al usuario y empezar.

Durante el trabajo: si se descubre algo que afecta a otro issue o persona, comentarlo en ese issue (`gh issue comment`), no solo en chat.
