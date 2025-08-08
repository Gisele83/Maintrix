@echo off
echo ====================================
echo   SMART GMAO DIAGFIX - FIX LOCALHOST
echo ====================================
echo.

echo Diagnostic de l'acces localhost:5000...
echo.

REM Test 1: Ping localhost
echo 1. Test connectivite localhost...
ping -n 2 localhost >nul
if %errorlevel%==0 (
    echo    [OK] localhost accessible
) else (
    echo    [ERREUR] localhost inaccessible
)

REM Test 2: Test port 5000
echo 2. Test du port 5000...
netstat -an | find ":5000" >nul
if %errorlevel%==0 (
    echo    [OK] Port 5000 en ecoute
) else (
    echo    [ATTENTION] Port 5000 pas detecte
)

REM Test 3: Verification pare-feu
echo 3. Verification pare-feu Windows...
netsh advfirewall show allprofiles state | find "ON" >nul
if %errorlevel%==0 (
    echo    [ATTENTION] Pare-feu Windows actif
    echo    Solution: Autorisez le port 5000 ou desactivez temporairement
) else (
    echo    [OK] Pare-feu Windows inactif
)

echo.
echo ====================================
echo   SOLUTIONS PROPOSEES
echo ====================================
echo.
echo 1. Ouvrez votre navigateur et essayez:
echo    - http://127.0.0.1:5000
echo    - http://localhost:5000
echo.
echo 2. Si ca ne fonctionne pas:
echo    - Desactivez temporairement votre antivirus
echo    - Lancez le navigateur en mode administrateur
echo    - Verifiez les parametres de proxy
echo.
echo 3. Configuration pare-feu Windows:
echo    - Panneau de configuration > Systeme et securite
echo    - Pare-feu Windows > Parametres avances
echo    - Regles de trafic entrant > Nouvelle regle
echo    - Type: Port, TCP, 5000, Autoriser
echo.
echo 4. Alternative - Version cloud:
echo    - Utilisez directement Replit dans votre navigateur
echo    - Pas d'installation locale necessaire
echo.

echo Appuyez sur une touche pour continuer...
pause >nul

REM Tentative de lancement automatique
echo Tentative d'ouverture automatique...
start http://127.0.0.1:5000
timeout /t 3
start http://localhost:5000

echo.
echo Si aucune page ne s'ouvre, suivez les solutions ci-dessus.
echo.
echo Fin du diagnostic.
pause