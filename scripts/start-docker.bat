@echo off
REM Maintrix - Script de demarrage Docker pour Windows
REM =====================================================

echo.
echo ==========================================
echo    MAINTRIX - Demarrage Docker v2.0
echo ==========================================
echo.

REM Verification de Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Docker n'est pas installe ou accessible.
    echo Veuillez installer Docker Desktop pour Windows.
    pause
    exit /b 1
)

echo [OK] Docker detecte

REM Creation des repertoires de donnees
echo [INFO] Creation des repertoires...
if not exist "data\postgres" mkdir data\postgres
if not exist "data\uploads" mkdir data\uploads
if not exist "data\logs" mkdir data\logs
if not exist "data\backups" mkdir data\backups

REM Verification du fichier .env
if not exist ".env" (
    if exist ".env.local.template" (
        copy .env.local.template .env
        echo [OK] Fichier .env cree
    ) else if exist ".env.example" (
        copy .env.example .env
        echo [OK] Fichier .env cree
    ) else (
        echo [ATTENTION] Aucun fichier .env trouve
    )
)

REM Choix du mode
echo.
echo Choisissez le mode:
echo   1) Simple (Application + PostgreSQL)
echo   2) Complet (Avec monitoring)
echo.
set /p choice="Votre choix [1/2]: "

if "%choice%"=="2" (
    set COMPOSE_FILE=docker-compose.yml
    echo [INFO] Mode complet selectionne
) else (
    set COMPOSE_FILE=docker-compose.simple.yml
    echo [INFO] Mode simple selectionne
)

echo.
echo [INFO] Construction et demarrage...
docker-compose -f %COMPOSE_FILE% up -d --build

echo.
echo ==========================================
echo    INSTALLATION TERMINEE
echo ==========================================
echo.
echo Accedez a Maintrix sur: http://localhost:5000
echo.
echo Commandes utiles:
echo   - Voir les logs: docker-compose -f %COMPOSE_FILE% logs -f
echo   - Arreter: docker-compose -f %COMPOSE_FILE% down
echo   - Redemarrer: docker-compose -f %COMPOSE_FILE% restart
echo.
pause
