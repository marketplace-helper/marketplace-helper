@echo off
chcp 65001 >nul
title Marketplace Helper
cd /d "%~dp0"

echo ============================================
echo   Marketplace Helper - Mercado Livre
echo ============================================
echo.

REM --- Instala dependencias na primeira vez ---
if not exist "node_modules\" (
    echo [1/5] Instalando dependencias ^(primeira vez^)...
    call npm install
) else (
    echo [1/5] Dependencias ja instaladas.
)

REM --- Sobe o Postgres local (Docker Desktop precisa estar aberto) ---
echo [2/5] Subindo o banco de dados ^(Postgres no Docker^)...
findstr /r /c:"^DATABASE_URL=.*file:" .env >nul 2>&1
if not errorlevel 1 (
    echo.
    echo ERRO: seu .env ainda aponta para o SQLite ^(DATABASE_URL="file:..."^).
    echo Troque pela linha DATABASE_URL do .env.example e rode de novo.
    pause
    exit /b 1
)
call docker compose up -d --wait >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERRO: nao foi possivel subir o Postgres.
    echo Abra o Docker Desktop, espere ele ficar "running" e rode de novo.
    pause
    exit /b 1
)

REM --- Garante client Prisma e banco atualizados (sempre) ---
echo [3/5] Atualizando banco de dados...
call npx prisma generate >nul 2>&1
call npx prisma migrate deploy
if errorlevel 1 (
    echo.
    echo ERRO ao aplicar as migrations. Veja a mensagem acima.
    pause
    exit /b 1
)

REM --- Libera a porta 3333 (encerra servidor antigo preso, se houver) ---
echo [4/5] Liberando a porta 3333...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3333" ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

REM --- Inicia o servidor ---
echo [5/5] Iniciando servidor na porta 3333...
start "Servidor ML" cmd /k "npm start"

REM --- Espera o servidor subir ---
timeout /t 4 /nobreak >nul

echo Abrindo no Google Chrome...

REM --- Abre no Chrome procurando nos caminhos comuns de instalacao ---
set "URL=http://localhost:3333"
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%URL%"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%URL%"
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%URL%"
) else (
    echo Chrome nao encontrado, abrindo no navegador padrao...
    start "" "%URL%"
)

echo.
echo Pronto! O servidor esta rodando na janela "Servidor ML".
echo Para encerrar, feche aquela janela.
timeout /t 3 /nobreak >nul
exit
