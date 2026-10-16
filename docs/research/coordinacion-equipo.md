# Coordinación de 3 personas + sus agentes
Fecha: 2026-10-16 · Autor: N

## Pregunta
¿Cómo trabajamos los tres a la vez, cada uno con su Claude Code, sin pisarnos ni hacer dos veces lo mismo?

## Hallazgos
- **Agent teams** (Claude Code, experimental, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`): lead + teammates con lista de tareas compartida y mensajería. Pero todo vive en `~/.claude/teams/` y `~/.claude/tasks/` **de una máquina**, "one team per session", no se comparte entre sesiones. Sirve para que *cada uno* paralelice su parte, no para unir a 3 personas. — [docs](https://code.claude.com/docs/en/agent-teams)
- **Cross-session messaging** (`SendMessage`/`ListAgents`): solo entre sesiones **del mismo usuario** (misma máquina, o sus otras máquinas vía Remote Control). No llega a la sesión de otra persona. — [docs](https://code.claude.com/docs/en/cross-session-messaging)
- **Claude Projects (claude.ai)**: se comparten con personas específicas solo en planes Team/Enterprise; dan instrucciones + conocimiento común para chats. No conectan con Claude Code ni coordinan tareas. — [soporte](https://support.claude.com/en/articles/9517075-what-are-projects)
- **GitHub** ya lo tenemos: repo compartido, `gh` CLI que Claude Code usa directo. Issues con *assignee* = "esto lo tengo yo"; comentarios = mensajes entre agentes de distintas personas; PRs = entrega. Es lo único que los 3 agentes ven igual.

## Decisión propuesta
**GitHub Issues es la fuente de verdad de quién hace qué.** Encima:
1. Hook `SessionStart` (`.claude/hooks/estado-equipo.sh`): al abrir `claude`, inyecta al contexto issues abiertos con dueño, sin dueño y PRs abiertos. Cada agente arranca sabiendo qué hacen los otros.
2. Skills: `/estado` (tablero), `/tomar-tarea` (verifica que nadie la tenga, se asigna, crea rama, comenta), `/entregar` (commit, PR con `Closes #n`, comenta resumen).
3. Mensajes entre agentes de distintas personas = comentarios en el issue (`gh issue comment`). Decisiones que afectan a todos = `docs/decisiones.md` vía PR.
4. Evitar choques de archivos: cada issue declara archivos/carpetas que toca; dos tareas abiertas no deberían tocar lo mismo.
5. Contexto común = `CLAUDE.md` + `docs/` en el repo (no hace falta Claude Project). Opcional: Claude Project en claude.ai si alguno tiene plan Team, para lluvia de ideas fuera del código.
6. Opcional por persona: agent teams local para paralelizar su propio issue.

## Preguntas abiertas
- ¿Tablero visual? GitHub Projects requiere `gh auth refresh -s project`. Issues + labels alcanza para 3 personas.
- ¿Alguien tiene plan Team de claude.ai?
