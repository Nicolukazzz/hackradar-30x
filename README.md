# HackRadar 30X

Proyecto del equipo para el hackathon HackRadar 30X. Reto elegido: **Blinka — Agentes que pagan por la empresa** ([brief](docs/retos/blinka.md)).

Estado: especificación v1 lista ([`docs/especificacion.md`](docs/especificacion.md)); stack propuesto, por aceptar en #1. Prototipo visual: [`docs/diseno/prototipo-ui.html`](docs/diseno/prototipo-ui.html) (descargar y abrir en el navegador).

Requisitos: Claude Code, Node 18+, [`gh`](https://cli.github.com/) con `gh auth login` hecho.

## Arranque (cada integrante)

```bash
git clone https://github.com/Nicolukazzz/hackradar-30x.git
cd hackradar-30x
claude
```

Al abrir Claude Code en la carpeta por primera vez:

1. Aceptar "trust this folder".
2. Aceptar instalar los plugins del proyecto (vienen en `.claude/settings.json`, marketplace oficial `claude-plugins-official`). Si no aparece el aviso: `/plugin` y habilitarlos.
3. Aprobar los MCP `playwright`, `shadcn` y `next-devtools` (`.mcp.json`). Requieren Node 20.19+ (`npx`).
4. `cp .env.example .env` y llenar llaves (nunca commitear `.env`).
5. (Opcional, para desplegar) Railway: pedir invitación al proyecto y correr `railway setup agent` (o `--oauth`). Ver [herramientas](docs/research/herramientas-claude-code.md).

Verificar: `/mcp` muestra los 3 MCP conectados; `/` lista las skills del proyecto.

## Qué hay

| Ruta | Para qué |
|---|---|
| `CLAUDE.md` | Contexto que Claude carga siempre: reto, invariantes, forma de trabajo |
| `docs/producto.md` | Qué construimos y por qué (producto, canales, LLM, roles) |
| `docs/especificacion.md` | Contrato técnico: tipos, reglas R1–R11, dataset, API, pantallas, evaluación |
| `docs/diseno/` | Prototipo navegable de las 5 pantallas |
| `docs/retos/` | Brief de los 4 retos copiados de la plataforma |
| `docs/decisiones.md` | Registro de decisiones del equipo |
| `docs/research/` | Hallazgos de investigación, un archivo por tema |
| `data/` | Dataset simulado: empresa, reglas, proveedores y escenarios (documentos + respuestas esperadas) |
| `.claude/settings.json` | Plugins, permisos y hooks compartidos |
| `.claude/skills/` | Skills del proyecto |
| `.mcp.json` | Servidores MCP compartidos |

## Cómo nos coordinamos

GitHub Issues = quién hace qué. Al abrir `claude`, un hook le muestra a tu agente los issues abiertos con dueño y los PRs, así no duplica trabajo.

1. `/estado` — ver qué está libre.
2. `/tomar-tarea #n` — te asigna, crea rama, avisa en el issue.
3. Trabajar. Avisos para otros = comentario en el issue.
4. `/entregar` — PR que cierra el issue.

Detalle y alternativas evaluadas: [docs/research/coordinacion-equipo.md](docs/research/coordinacion-equipo.md).

## Skills del proyecto

- `/estado`, `/tomar-tarea`, `/entregar` — coordinación.
- `/investigar <tema>` — investiga y guarda en `docs/research/`.
- `/registrar-decision <decisión>` — agrega a `docs/decisiones.md`.
- `/generar-facturas [n] [trampa]` — facturas simuladas + respuesta esperada.
- `/evaluar-agente` — mide autonomía, seguridad y explicabilidad.
- Externas: `shadcn`, `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, `use-railway`, `test-driven-development`, `systematic-debugging`, `verification-before-completion` (lock en `skills-lock.json`, actualizar con `npx skills update -p`).

## Plugins del proyecto

`context7` (docs de librerías al día) · `frontend-design` (UI) · `code-review` · `feature-dev` (flujo de features) · `security-guidance` · `claude-md-management` (mantener CLAUDE.md).

## Flujo git

Ramas `feat/…`, `fix/…`, `docs/…` → PR → `/code-review` → merge a `main`. Conventional Commits.

Preferencias personales de Claude Code: `.claude/settings.local.json` (ignorado por git).
