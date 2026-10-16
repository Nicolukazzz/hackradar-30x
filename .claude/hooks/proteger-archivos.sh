#!/usr/bin/env bash
# Bloquea ediciones a archivos de secretos (.env, llaves). .env.example sí se permite.
# Recibe JSON del tool call por stdin. Exit 2 = bloquear y mostrar mensaje a Claude.

input=$(cat)
path=$(printf '%s' "$input" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')

[ -z "$path" ] && exit 0
name=$(basename "$path")

case "$name" in
  .env.example) exit 0 ;;
  .env|.env.*|*.pem|*.key|credentials*.json)
    echo "Bloqueado: '$name' contiene secretos. Edítalo a mano, no desde Claude. Documenta variables en .env.example." >&2
    exit 2
    ;;
esac

exit 0
