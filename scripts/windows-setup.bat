@echo off
cls
title Maintrix - Installateur Windows

echo =========================================
echo Maintrix - Installateur Windows
echo Version 2.1.0
echo =========================================
echo.

:: Vérifier les privilèges administrateur
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERREUR: Cet installateur doit être exécuté en tant qu'administrateur.
    echo Clic droit sur le fichier et choisissez "Exécuter en tant qu'administrateur"
    pause
    exit /b 1
)

echo [1/8] Vérification des prérequis...

:: Créer le répertoire d'installation
set INSTALL_DIR=%ProgramFiles%\Maintrix
if exist "%INSTALL_DIR%" (
    echo Suppression de l'ancienne installation...
    rmdir /s /q "%INSTALL_DIR%"
)
mkdir "%INSTALL_DIR%"

echo [2/8] Installation de Node.js...
:: Vérifier si Node.js est installé
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Téléchargement de Node.js...
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.19.0/node-v18.19.0-x64.msi' -OutFile '%TEMP%\nodejs.msi'"
    echo Installation de Node.js...
    msiexec /i "%TEMP%\nodejs.msi" /quiet /norestart
    set PATH=%PATH%;%ProgramFiles%\nodejs
) else (
    echo Node.js déjà installé.
)

echo [3/8] Installation de PostgreSQL...
:: Vérifier si PostgreSQL est installé
psql --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Téléchargement de PostgreSQL...
    powershell -Command "Invoke-WebRequest -Uri 'https://get.enterprisedb.com/postgresql/postgresql-15.5-1-windows-x64.exe' -OutFile '%TEMP%\postgresql.exe'"
    echo Installation de PostgreSQL...
    "%TEMP%\postgresql.exe" --mode unattended --superpassword postgres123 --servicename postgresql --servicepassword postgres123
) else (
    echo PostgreSQL déjà installé.
)

echo [4/8] Extraction des fichiers...
:: Copier les fichiers de l'application
xcopy /e /i /h /y . "%INSTALL_DIR%"

cd /d "%INSTALL_DIR%"

echo [5/8] Installation des dépendances...
call npm install --production

echo [6/8] Configuration de la base de données...
:: Créer le fichier .env
(
echo DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/maintrix_db
echo NODE_ENV=production
echo PORT=5000
echo SESSION_SECRET=maintrix_secret_key_2025
echo.
echo # Configuration Paiements - Remplir avec vos cles
echo STRIPE_SECRET_KEY=
echo STRIPE_PUBLISHABLE_KEY=
echo PAYPAL_CLIENT_ID=
echo PAYPAL_CLIENT_SECRET=
echo PAYPAL_MODE=sandbox
) > .env

:: Attendre que PostgreSQL soit prêt
timeout /t 10 /nobreak

:: Créer la base de données
echo Création de la base de données...
echo CREATE DATABASE maintrix_db; | psql -U postgres -h localhost

:: Initialiser le schéma
call npm run db:push

echo [7/8] Configuration du service Windows...
:: Installer node-windows globalement
call npm install -g node-windows

:: Créer le script de service
(
echo const { Service } = require('node-windows'^);
echo.
echo const svc = new Service({
echo   name: 'Maintrix',
echo   description: 'Service de maintenance industrielle intelligente',
echo   script: '%INSTALL_DIR%\\server\\index.js',
echo   env: {
echo     name: 'NODE_ENV',
echo     value: 'production'
echo   }
echo }^);
echo.
echo svc.on('install', function(^) {
echo   svc.start(^);
echo }^);
echo.
echo svc.install(^);
) > install-service.js

:: Installer et démarrer le service
call node install-service.js

echo [8/8] Création des raccourcis...
:: Créer le raccourci sur le bureau
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\Maintrix.lnk'); $Shortcut.TargetPath = 'http://localhost:5000'; $Shortcut.Save()"

:: Créer le raccourci dans le menu démarrer
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%APPDATA%\Microsoft\Windows\Start Menu\Programs\Maintrix.lnk'); $Shortcut.TargetPath = 'http://localhost:5000'; $Shortcut.Save()"

:: Configurer le pare-feu
echo Configuration du pare-feu...
netsh advfirewall firewall add rule name="Maintrix" dir=in action=allow protocol=TCP localport=5000

echo.
echo =======================================
echo INSTALLATION TERMINÉE AVEC SUCCÈS !
echo =======================================
echo.
echo Maintrix a été installé et configuré.
echo.
echo Accès:
echo - URL: http://localhost:5000
echo - Email: admin@maintrix.local
echo - Mot de passe: Maintrix2024!
echo - Raccourci sur le Bureau créé
echo - Service Windows configuré
echo.
echo L'application va s'ouvrir automatiquement...

:: Attendre quelques secondes puis ouvrir l'application
timeout /t 5 /nobreak
start http://localhost:5000

echo.
echo Installation complète ! Profitez de Maintrix.
pause