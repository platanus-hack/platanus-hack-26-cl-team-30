#!/bin/bash
# Abre la presentación de Sculptor como una app, sin correr nada a mano.
# - Si el servidor de la presentación no está andando, lo levanta en segundo plano
#   (next start en el puerto 47530; si no hay build, la hace primero).
# - Abre /presentacion en una ventana propia de Chrome (modo app, pantalla completa).
# La sala de la lámina en vivo sale de .env.local (PRESENTACION_DEMO_URL y
# PRESENTACION_DEMO_SALA). Registro del servidor: /tmp/sculptor-presentacion.log
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PRESENTACION_PORT:-47530}"
URL="http://localhost:${PORT}/presentacion#1"
LOG="/tmp/sculptor-presentacion.log"

# Las apps del Finder no heredan el PATH de la terminal: buscar node (nvm incluido).
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
fi
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
command -v node >/dev/null 2>&1 || { osascript -e 'display alert "No encuentro Node.js" message "Instala Node o abre la presentación desde la terminal."'; exit 1; }

# -f: solo cuenta si responde la presentación (otro programa podría ocupar el puerto).
up() { curl -sf -o /dev/null -m 3 "http://localhost:${PORT}/presentacion"; }

if ! up; then
  cd "$DIR"
  if [ ! -f .next/BUILD_ID ]; then
    osascript -e 'display notification "Preparando la presentación (primera vez, ~1 min)…" with title "Sculptor"' || true
    npm run build >"$LOG" 2>&1
  fi
  nohup npx next start -p "$PORT" >>"$LOG" 2>&1 &
  for _ in $(seq 1 60); do up && break; sleep 1; done
fi

if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="$URL" --start-fullscreen --autoplay-policy=no-user-gesture-required
else
  open "$URL"
fi
