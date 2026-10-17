#!/usr/bin/env bash
# Tests de integración del repositorio contra Supabase local (#44). Reinicia la base desde cero (las
# migraciones se aplican al arrancar) porque el registro es append-only y no se puede vaciar.
set -euo pipefail
EXCLUIR="studio,imgproxy,realtime,edge-runtime,logflare,vector,supavisor,mailpit"
supabase stop --no-backup >/dev/null 2>&1 || true
supabase start -x "$EXCLUIR" >/dev/null
estado=$(supabase status -o json)
leer() { node -e "process.stdout.write(JSON.parse(process.argv[1])[process.argv[2]])" "$estado" "$1"; }
SUPABASE_PRUEBA_URL=$(leer API_URL) SUPABASE_PRUEBA_CLAVE=$(leer SECRET_KEY) SUPABASE_PRUEBA_PUBLICA=$(leer PUBLISHABLE_KEY) \
  npx vitest run tests/repositorio/supabase.test.ts
