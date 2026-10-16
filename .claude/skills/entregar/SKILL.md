---
name: entregar
description: Cerrar el trabajo de un issue - commit, push, PR que cierra el issue y aviso al equipo. Usar cuando digan "listo", "terminé", "sube esto", "abre PR".
---

1. Rama actual debe ser `<tipo>/<n>-...`. Sacar `<n>` del nombre. Si estoy en `main`, parar: crear rama primero.
2. `git status` + `git diff`. Revisar que no haya `.env`, llaves ni datos reales. Correr tests/lint si existen (ver "Stack y comandos" en `CLAUDE.md`); si fallan, decirlo y no abrir PR sin confirmación.
3. Commit Conventional Commits. `git pull --rebase origin main`; resolver conflictos si hay, preguntando si son en archivos de otra persona.
4. `git push -u origin HEAD`.
5. `gh pr create --fill-first` con cuerpo: qué cambió, cómo probar, `Closes #<n>`, y si afecta a otros issues, mencionarlos.
6. `gh issue comment <n> --body "PR listo: <url>. <1 línea de resumen>."`
7. Si la entrega cambió una decisión o contrato compartido (formato de datos, API, reglas), agregar a `docs/decisiones.md` en el mismo PR.
8. Sugerir siguiente: `/estado`.
