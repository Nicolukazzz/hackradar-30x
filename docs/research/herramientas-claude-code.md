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
| `21st` | Buscar componentes en 21st.dev (HTTP `https://21st.dev/api/mcp`, header `x-api-key`) | Free: búsquedas sin límite, **2 `get_component` por día**, sin generación IA. Usar para buscar ideas; instalar preferentemente vía `shadcn` |
| `supabase` | Tablas, migraciones, logs y docs de Supabase (HTTP `https://mcp.supabase.com/mcp`, OAuth) | Gratis (free tier de Supabase) |

Versiones fijadas (`@playwright/mcp@0.0.83`, `shadcn@4.22.0`, `next-devtools-mcp@0.4.0`) para que una actualización no rompa la demo. Subirlas a propósito.

**21st**: la llave va en la shell, no en `.env` ni en el repo (`.mcp.json` lee `${API_KEY_21ST:-}`; sin llave el server queda desconectado y nada más se rompe). fish: `set -Ux API_KEY_21ST <llave>`; bash/zsh: `export API_KEY_21ST=<llave>` en el perfil. Reiniciar `claude`.

**Supabase con una cuenta que no es la personal**: el OAuth usa la sesión de Supabase abierta en el navegador. Para entrar con la cuenta del equipo:
1. Crear la cuenta del equipo en supabase.com con el correo elegido, en una ventana privada (o cerrar sesión de la personal).
2. En `claude`: `/mcp` → `supabase` → *Authenticate*. Si el navegador abre la cuenta personal, copiar la URL que muestra Claude Code y pegarla en la ventana privada.
3. Conceder acceso solo a la organización del equipo.
4. Proyecto fijado: org `Hackaton30x`, `project_ref=ugmwsrtrfgemqvnbcszw` en `.mcp.json` (limita el MCP a ese proyecto). El conector `claude.ai Supabase` (cuenta personal) está bloqueado en `deny` de `.claude/settings.json`.
El server de proyecto se llama `supabase`; el plugin `supabase` del usuario es otro server con su propio token, así no se mezclan.

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
| `supabase`, `supabase-postgres-best-practices` | `supabase/agent-skills` | Esquema, RLS, migraciones, cliente SSR en Next |
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
- **Gráficos de shadcn** (`chart`, sobre Recharts): KPIs y gráficos de la Bandeja.
- **React Bits** (`@react-bits/<Nombre>-TS-TW`): textos y números animados, fondos sutiles.
- **Skiper UI** (`@skiper-ui/...`): componentes con acabado premium. Hay gratis y "pro": solo gratis.
- **Magic UI**, **Aceternity**, **Kibo UI**: detalles visuales (números animados, timeline para la Traza, inputs).
- **21st.dev**: buscador de componentes de la comunidad, vía MCP `21st`.

`@react-bits`, `@skiper-ui`, `@magicui`, `@aceternity` y `@kibo-ui` ya están en el índice oficial de registros de shadcn (`ui.shadcn.com/r/registries.json`): se instalan con `npx shadcn add @react-bits/SplitText-TS-TW` sin configurar nada.

Regla: usar pocos componentes "llamativos". El prototipo es sobrio; la confianza vende más que las animaciones.

## Fuentes

- [shadcn MCP](https://ui.shadcn.com/docs/mcp) · [21st MCP](https://github.com/21st-dev/magic-mcp) · [Supabase MCP](https://supabase.com/docs/guides/getting-started/mcp) · [React Bits](https://reactbits.dev/get-started/installation) · [Skiper UI](https://skiper-ui.com/components)
- [Railway remote MCP](https://docs.railway.com/ai/remote-mcp-server)
- [next-devtools-mcp](https://github.com/vercel/next-devtools-mcp)
- [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) · [obra/superpowers](https://github.com/obra/superpowers) · [railwayapp/railway-skills](https://github.com/railwayapp/railway-skills)

## Preguntas abiertas

- Resuelto: deploy en Railway Hobby (USD 5) + Supabase en cuenta del equipo. Ver `docs/decisiones.md`.
