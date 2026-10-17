#!/usr/bin/env bash
# Tests de integración del repositorio contra Supabase local (#44). Reinicia la base local desde cero (las
# migraciones se aplican al arrancar) porque el registro es append-only y no se puede vaciar.
# BORRA los datos del Supabase local (usuarios sembrados incluidos): pide confirmación con --si.
set -euo pipefail
if [[ "${1:-}" != "--si" ]]; then
  echo "Esto borra el Supabase LOCAL (no el del equipo) y lo vuelve a crear. Correr: npm run test:supabase -- --si" >&2
  exit 1
fi
EXCLUIR="studio,imgproxy,realtime,edge-runtime,logflare,vector,supavisor,mailpit"
supabase stop --no-backup >/dev/null 2>&1 || true
supabase start -x "$EXCLUIR" >/dev/null
estado=$(supabase status -o json)
# Las versiones nuevas de la CLI dan SECRET_KEY/PUBLISHABLE_KEY; las viejas SERVICE_ROLE_KEY/ANON_KEY.
leer() { node -e "const e=JSON.parse(process.argv[1]); const v=process.argv.slice(2).map((k)=>e[k]).find(Boolean); if(!v){console.error('falta '+process.argv.slice(2).join(' o ')+' en supabase status'); process.exit(1)} process.stdout.write(v)" "$estado" "$@"; }
SUPABASE_PRUEBA_URL=$(leer API_URL) SUPABASE_PRUEBA_CLAVE=$(leer SECRET_KEY SERVICE_ROLE_KEY) SUPABASE_PRUEBA_PUBLICA=$(leer PUBLISHABLE_KEY ANON_KEY) \
  npx vitest run tests/repositorio/supabase.test.ts
