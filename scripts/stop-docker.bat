@echo off
REM Maintrix - Script d'arret Docker pour Windows

echo Arret de Maintrix...

docker-compose down 2>nul
docker-compose -f docker-compose.simple.yml down 2>nul

echo Maintrix arrete.
pause
