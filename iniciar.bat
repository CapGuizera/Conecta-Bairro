@echo off
rem ============================================================
rem  ConectaBairro - inicializacao no Windows
rem  De dois cliques neste arquivo. Requer Node.js 22 LTS:
rem  https://nodejs.org
rem ============================================================
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title ConectaBairro

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js nao encontrado.
  echo  Instale a versao LTS em https://nodejs.org e rode este arquivo de novo.
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

node scripts\check-node.js || (pause & exit /b 1)

if not exist node_modules\ (
  echo Instalando dependencias, so na primeira vez. Pode levar alguns minutos...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto erro
)

if not exist web\dist\index.html (
  echo Preparando a interface...
  call npm run build
  if errorlevel 1 goto erro
)

if not exist .env copy .env.example .env >nul

echo.
echo Abrindo http://localhost:3000 no navegador...
start "" cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:3000"
node server\src\index.js
pause
exit /b 0

:erro
echo.
echo Algo deu errado. Veja a mensagem acima. Se for problema de rede,
echo verifique a internet e rode o iniciar.bat novamente.
pause
exit /b 1
