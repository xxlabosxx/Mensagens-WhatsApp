@echo off
cd /d "%~dp0"
echo Iniciando Central de Comunicacao - Rede IF EcoSol...
start "" "http://localhost:3000"
npm start
pause
