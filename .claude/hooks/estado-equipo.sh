#!/usr/bin/env bash
# SessionStart: muestra a Claude quién trabaja en qué (issues y PRs de GitHub).
# Lo que imprime por stdout entra al contexto de la sesión. Nunca falla la sesión.

if ! command -v gh >/dev/null 2>&1; then
  echo "[estado-equipo] gh CLI no instalado: no se puede ver qué hacen los demás. Instalar gh y correr 'gh auth login'."
  exit 0
fi

yo=$(timeout 5 gh api user --jq .login 2>/dev/null)
issues=$(timeout 8 gh issue list --state open --limit 50 \
  --json number,title,assignees,labels \
  --jq '.[] | "#\(.number) [\(if (.assignees|length)>0 then (.assignees|map(.login)|join(",")) else "SIN DUEÑO" end)] \(.title)"' 2>/dev/null)
prs=$(timeout 8 gh pr list --state open --limit 20 \
  --json number,title,author,headRefName \
  --jq '.[] | "PR #\(.number) [\(.author.login)] \(.title) (\(.headRefName))"' 2>/dev/null)

echo "[estado-equipo] Usuario GitHub actual: ${yo:-desconocido}. Rama local: $(git branch --show-current 2>/dev/null)"
echo "Issues abiertos (dueño entre corchetes):"
echo "${issues:-  (ninguno o sin acceso)}"
echo "PRs abiertos:"
echo "${prs:-  (ninguno)}"
echo "Regla: no trabajar en un issue asignado a otra persona. Para tomar uno usar /tomar-tarea."
exit 0
