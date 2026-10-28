#!/usr/bin/env bash
# ConectaBairro - inicialização no Linux e macOS. Requer Node.js 22 LTS.
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js não encontrado. Instale a versão LTS em https://nodejs.org"
  exit 1
fi
node scripts/check-node.js

if [ ! -d node_modules ]; then
  echo "Instalando dependências (só na primeira vez)..."
  npm install --no-audit --no-fund
fi
if [ ! -f web/dist/index.html ]; then
  echo "Preparando a interface..."
  npm run build
fi
[ -f .env ] || cp .env.example .env

( sleep 6; (xdg-open http://localhost:3000 || open http://localhost:3000) >/dev/null 2>&1 || true ) &
exec node server/src/index.js
