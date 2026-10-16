# HackRadar 30X

Proyecto del equipo para el hackathon HackRadar 30X. Reto candidato: **Blinka — Agentes que pagan por la empresa** ([brief](docs/retos/blinka.md)).

Estado: investigación. Stack por definir.

## Arranque (cada integrante)

```bash
git clone https://github.com/Nicolukazzz/hackradar-30x.git
cd hackradar-30x
claude
```

Al abrir Claude Code en la carpeta por primera vez:

1. Aceptar "trust this folder".
2. Aceptar instalar los plugins del proyecto (vienen en `.claude/settings.json`, marketplace oficial `claude-plugins-official`). Si no aparece el aviso: `/plugin` y habilitarlos.
3. Aprobar el MCP `playwright` (`.mcp.json`). Requiere Node 18+ (`npx`).
4. `cp .env.example .env` y llenar llaves (nunca commitear `.env`).

Verificar: `/mcp` muestra `playwright` conectado; `/` lista las skills del proyecto.

## Qué hay

| Ruta | Para qué |
|---|---|
| `CLAUDE.md` | Contexto que Claude carga siempre: reto, invariantes, forma de trabajo |
| `docs/retos/` | Brief de los 4 retos copiados de la plataforma |
| `docs/decisiones.md` | Registro de decisiones del equipo |
| `docs/research/` | Hallazgos de investigación, un archivo por tema |
| `data/` | Dataset simulado: empresa, reglas, proveedores, facturas, respuestas esperadas |
| `.claude/settings.json` | Plugins, permisos y hooks compartidos |
| `.claude/skills/` | Skills del proyecto |
| `.mcp.json` | Servidores MCP compartidos |

## Skills del proyecto

- `/investigar <tema>` — investiga y guarda en `docs/research/`.
- `/registrar-decision <decisión>` — agrega a `docs/decisiones.md`.
- `/generar-facturas [n] [trampa]` — facturas simuladas + respuesta esperada.
- `/evaluar-agente` — mide autonomía, seguridad y explicabilidad.

## Plugins del proyecto

`context7` (docs de librerías al día) · `frontend-design` (UI) · `code-review` · `feature-dev` (flujo de features) · `security-guidance` · `claude-md-management` (mantener CLAUDE.md).

## Flujo git

Ramas `feat/…`, `fix/…`, `docs/…` → PR → `/code-review` → merge a `main`. Conventional Commits.

Preferencias personales de Claude Code: `.claude/settings.local.json` (ignorado por git).
