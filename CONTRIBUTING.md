# Cómo trabajamos

Somos 3 personas, cada una con su Claude Code. Los agentes de distintas personas no se hablan directo: **GitHub Issues es el canal común**. Contexto completo para el agente en [`CLAUDE.md`](CLAUDE.md); detalle y alternativas evaluadas en [`docs/research/coordinacion-equipo.md`](docs/research/coordinacion-equipo.md).

## Arranque

Requisitos: Claude Code, Node ≥ 22.12, [`gh`](https://cli.github.com/) con `gh auth login` hecho.

```bash
git clone https://github.com/Nicolukazzz/hackradar-30x.git
cd hackradar-30x
npm ci
cp .env.example .env   # llenar llaves; nunca commitear .env
claude
```

Al abrir Claude Code en la carpeta por primera vez:

1. Aceptar "trust this folder".
2. Aceptar instalar los plugins del proyecto (`.claude/settings.json`, marketplace `claude-plugins-official`). Si no aparece el aviso: `/plugin` y habilitarlos.
3. Aprobar los MCP de `.mcp.json` (`playwright`, `shadcn`, `next-devtools`, `21st`, `supabase`). Corren con `npx`.
   - `21st`: llave gratis en https://21st.dev/mcp y `export API_KEY_21ST=<llave>` (fish: `set -Ux API_KEY_21ST <llave>`) antes de abrir `claude`.
   - `supabase`: `/mcp` → `supabase` → Authenticate **con la cuenta del equipo**, nunca la personal (ventana privada si tu navegador tiene otra sesión).
   - `playwright`: usa Google Chrome del sistema. Para otro navegador, solo para ti (scope local, no va al repo):
     `claude mcp add playwright -s local -- npx -y @playwright/mcp@0.0.83 --executable-path /opt/brave.com/brave/brave`
4. Python para el dataset: `python3 -m venv .venv && .venv/bin/pip install -r scripts/dataset/requirements.txt`.
5. (Opcional, para desplegar) Railway: pedir invitación al proyecto y correr `railway setup agent`. Ver [herramientas](docs/research/herramientas-claude-code.md).

Verificar: `/mcp` muestra los MCP conectados, `/` lista las skills y `npm run typecheck && npm run lint && npm test` queda en verde.

## Flujo de trabajo

Todo trabajo tiene issue. Al abrir `claude`, un hook le muestra a tu agente los issues abiertos con dueño y los PRs, para no duplicar trabajo.

1. `/estado`: ver qué está libre.
2. `/tomar-tarea #n`: te asigna, crea la rama `<tipo>/<n>-slug` y avisa en el issue.
3. Trabajar. **Nunca** en un issue asignado a otra persona ni en archivos que su issue declara. Un aviso para otra persona es un comentario en su issue (`gh issue comment <n>`).
4. `/code-review` sobre el diff.
5. `/entregar`: commit, push y PR con `Closes #n`.

Reglas:

- Un issue = una rama = un PR chico. Merge rápido, `git pull --rebase origin main` seguido.
- Commits en [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `test:`), en español o inglés.
- Un cambio a un contrato compartido (formato de `data/`, esquema de reglas, API entre módulos) actualiza también [`docs/decisiones.md`](docs/decisiones.md) y avisa en los issues afectados.
- `data/` no se edita a mano: se cambia `scripts/dataset/` y se corre `npm run dataset`.
- Migraciones de `supabase/migrations/` se aplican en el Supabase del equipo **antes** de mergear el PR que las usa: no se aplican solas al desplegar.
- `main` se despliega solo a Railway en cada merge, así que siempre debe pasar CI: `typecheck` → `lint` → `test` → `evaluar --todos` (falla con un pago indebido) → `build`. SonarCloud también revisa.

## Skills del proyecto

| Skill | Para qué |
|---|---|
| `/estado`, `/tomar-tarea`, `/entregar` | Coordinación por issues |
| `/investigar <tema>` | Investiga y guarda el hallazgo en `docs/research/` |
| `/registrar-decision <decisión>` | Agrega una entrada a `docs/decisiones.md` |
| `/generar-facturas [n] [trampa]` | Facturas simuladas con su respuesta esperada |
| `/evaluar-agente` | Mide autonomía, seguridad y explicabilidad |

Externas (lock en `skills-lock.json`, actualizar con `npx skills update -p`): `shadcn`, `supabase`, `supabase-postgres-best-practices`, `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, `use-railway`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`.

Plugins: `context7` · `frontend-design` · `code-review` · `feature-dev` · `security-guidance` · `claude-md-management`.

## Configuración de Claude Code

| Archivo | Para qué |
|---|---|
| `CLAUDE.md` | Contexto que Claude carga siempre: reto, invariantes, forma de trabajo |
| `AGENTS.md` | Reglas de Next.js 16 para agentes (lo regenera `next dev`) |
| `.claude/settings.json` | Plugins, permisos y hooks compartidos |
| `.claude/skills/` | Skills del proyecto |
| `.mcp.json` | Servidores MCP compartidos (versiones fijadas; subirlas a propósito) |
| `.claude/settings.local.json` | Preferencias personales (ignorado por git) |
