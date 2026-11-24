#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "🌿 Iniciando Central de Comunicação - Rede IF EcoSol..."
(sleep 2 && xdg-open "http://localhost:3000" >/dev/null 2>&1 || true) &
npm start
