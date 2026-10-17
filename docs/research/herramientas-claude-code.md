# Herramientas de Claude Code para el proyecto (MCPs y skills)

Fecha: 2026-10-16 · Issue #1 · Quién: N

## Pregunta

Qué MCPs y skills dejar configurados en el repo para que los 3 agentes construyan la app (Next.js + TS + Vitest, deploy en Railway) con UI decente y sin pagar nada.

## Qué quedó configurado

### MCPs compartidos (`.mcp.json`, habilitados en `.claude/settings.json`)

| MCP | Para qué | Costo |
|---|---|---|
| `playwright` | Abrir la app, hacer clic, sacar capturas, revisar pantallas | Gratis |
| `shadcn` | Buscar, ver y agregar componentes de shadcn/ui y de registros comunitarios gratuitos | Gratis, sin llave |
| `next-devtools` | Leer errores de build y runtime, rutas y logs del `next dev` en vivo (Next 16+ expone `/_next/mcp`) | Gratis |

`shadcn` necesita `components.json` en la raíz (lo crea `npx shadcn init` en el paso de esqueleto). Sin él, el MCP arranca pero no sabe dónde instalar.

### Railway (deploy) — MCP por persona, no en el repo

Railway liga el MCP a la cuenta de cada quien, así que no va en `.mcp.json`:

- **Dueño del proyecto (N)**: MCP `railway` en scope usuario (`railway mcp`, usa el login del CLI). Verificado con `whoami`.
- **Resto del equipo**: N los invita al proyecto en Railway y cada uno corre `railway setup agent` (usa su `railway login`) o `railway setup agent --oauth` (MCP remoto `https://mcp.railway.com`, sin CLI). Requiere CLI ≥ 5.44.
- Las herramientas de solo lectura (`list-*`, `get-logs`, `get-status`…) están permitidas sin prompt. Las que crean, despliegan, borran o leen variables (`list-variables`) siguen pidiendo permiso.

### Skills de proyecto (`.claude/skills/`, versiones fijadas en `skills-lock.json`)

| Skill | Origen | Para qué |
|---|---|---|
| `shadcn` | `shadcn/ui` | Usar shadcn bien: init, registros, theming con los tokens de especificación §15 |
| `vercel-react-best-practices` | `vercel-labs/agent-skills` | Reglas de rendimiento React/Next (RSC, data fetching, bundle) |
| `vercel-composition-patterns` | `vercel-labs/agent-skills` | Componentes reutilizables sin explosión de props |
| `web-design-guidelines` | `vercel-labs/agent-skills` | Auditar UI: accesibilidad, foco, contraste, formularios |
| `use-railway` | `railwayapp/railway-skills` | Desplegar, variables, dominios, logs en Railway |
| `test-driven-development` | `obra/superpowers` | Test primero: clave para el motor de reglas R1–R11 |
| `systematic-debugging` | `obra/superpowers` | Depurar con hipótesis, no a ciegas |
| `verification-before-completion` | `obra/superpowers` | No decir "listo" sin correr `npm test` / `typecheck` |

Actualizar: `npx skills update -p`. Restaurar desde el lock: `npx skills experimental_install`.

Descartada: `next-dev-loop` (`vercel/next.js`) exige el CLI `agent-browser` y Next 16.3+; para eso ya están `next-devtools` + `playwright`.

### Plugins (ya estaban en `.claude/settings.json`)

`context7` (docs de librerías al día), `frontend-design`, `code-review`, `feature-dev`, `security-guidance`, `claude-md-management`.

## Bibliotecas de componentes gratuitas (vía MCP `shadcn`)

shadcn/ui no es una dependencia: copia el código del componente al repo, así que se puede ajustar a los tokens del prototipo (§15). Registros gratuitos útiles para este producto (confirmar namespaces al hacer `shadcn init`):

- **shadcn/ui** base: tabla, badge (píldoras de decisión), dialog, tabs, form, sidebar.
- **Tremor / gráficos de shadcn**: KPIs y gráficos de la Bandeja (autonomía, pagadas, frenadas).
- **Magic UI**, **Origin UI**, **Kibo UI**: detalles visuales (números animados, timeline para la Traza, inputs).

Regla: usar pocos componentes "llamativos". El prototipo es sobrio; la confianza vende más que las animaciones.

## Fuentes

- [shadcn MCP](https://ui.shadcn.com/docs/mcp)
- [Railway remote MCP](https://docs.railway.com/ai/remote-mcp-server)
- [next-devtools-mcp](https://github.com/vercel/next-devtools-mcp)
- [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) · [obra/superpowers](https://github.com/obra/superpowers) · [railwayapp/railway-skills](https://github.com/railwayapp/railway-skills)

## Preguntas abiertas

- ¿Persistencia en deploy: Supabase (decisión propuesta) o Postgres de Railway? Ver recomendación en el PR de #1.
