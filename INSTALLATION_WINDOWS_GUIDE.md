# 🚀 MAINTRIX - Guide d'Installation Windows

Guide complet pour l'installation et le déploiement de Maintrix sur Windows avec WSL2 et Docker Desktop.

---

## 📋 **Prérequis Windows**

### **Versions Windows Supportées**
- **Windows 11**: Home, Pro, Enterprise, Education (22H2 ou supérieur)
- **Windows 10**: Home, Pro, Enterprise, Education (build 19041 ou supérieur)
- **Windows Server**: 2019, 2022, 2025 avec containers support

### **Configuration Matérielle Minimale**
- **RAM**: 8 GB minimum (16 GB recommandé)
- **Stockage**: 25 GB d'espace libre (50 GB recommandé)
- **Processeur**: 64-bit avec support de virtualisation (Intel VT-x ou AMD-V)
- **BIOS/UEFI**: Virtualisation hardware activée

### **Configuration Recommandée Production**
- **RAM**: 32 GB ou plus
- **Stockage**: 100 GB SSD NVMe
- **Processeur**: 8 cores ou plus
- **Réseau**: Connexion stable 1 Gbps+

---

## 🔧 **Préparation de l'Environnement Windows**

### **1. Activation de WSL2**

**Méthode Automatique (Windows 11/10 récent):**
```powershell
# Exécuter en tant qu'administrateur
wsl --install
```

**Méthode Manuelle:**
```powershell
# 1. Activation des fonctionnalités Windows
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# 2. Redémarrage requis
Restart-Computer

# 3. Téléchargement et installation du kernel WSL2
$kernelUrl = "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi"
Invoke-WebRequest -Uri $kernelUrl -OutFile "$env:TEMP\wsl_update_x64.msi"
Start-Process msiexec.exe -Wait -ArgumentList "/I $env:TEMP\wsl_update_x64.msi /quiet"

# 4. Configuration WSL2 par défaut
wsl --set-default-version 2
```

### **2. Installation d'Ubuntu sur WSL2**

**Via Microsoft Store:**
1. Ouvrir Microsoft Store
2. Rechercher "Ubuntu 22.04 LTS"
3. Cliquer "Installer"
4. Lancer Ubuntu et créer un utilisateur Linux

**Via PowerShell:**
```powershell
# Installation automatique
wsl --install -d Ubuntu-22.04

# Vérification
wsl -l -v
```

### **3. Installation de Docker Desktop**

**Téléchargement et Installation:**
```powershell
# Téléchargement automatique
$dockerUrl = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
Invoke-WebRequest -Uri $dockerUrl -OutFile "$env:TEMP\DockerDesktopInstaller.exe"

# Installation silencieuse avec WSL2
Start-Process "$env:TEMP\DockerDesktopInstaller.exe" -Wait -ArgumentList "install --quiet --accept-license --backend=wsl-2"
```

**Configuration Docker Desktop:**
1. Lancer Docker Desktop
2. Aller dans Settings > General
3. Cocher "Use WSL 2 based engine"
4. Aller dans Settings > Resources > WSL Integration
5. Activer l'intégration avec Ubuntu-22.04

---

## 🚀 **Installation Maintrix**

### **Méthode 1: Installation Automatique PowerShell**

**Téléchargement et Exécution:**
```powershell
# Exécuter PowerShell en tant qu'administrateur

# Option 1: Depuis les sources
git clone https://github.com/votre-org/maintrix.git
cd maintrix
.\install-maintrix.ps1

# Option 2: Téléchargement direct
Invoke-WebRequest -Uri "https://releases.maintrix.com/install-maintrix.ps1" -OutFile "install-maintrix.ps1"
.\install-maintrix.ps1
```

**Options d'Installation:**
```powershell
# Installation personnalisée
.\install-maintrix.ps1 -WebPort 9000 -DomainName "maintrix.local" -InstallDir "D:\Maintrix"

# Installation avec mot de passe personnalisé
.\install-maintrix.ps1 -DbPassword "MonMotDePasseSecurise123!"

# Installation sans WSL (si déjà configuré)
.\install-maintrix.ps1 -SkipWSL

# Affichage détaillé
.\install-maintrix.ps1 -Verbose
```

### **Méthode 2: Installation Manuelle**

**1. Préparation des Répertoires:**
```powershell
# Création de la structure
New-Item -Path "C:\Maintrix" -ItemType Directory -Force
New-Item -Path "C:\Maintrix\data" -ItemType Directory -Force
New-Item -Path "C:\Maintrix\data\postgres" -ItemType Directory -Force
New-Item -Path "C:\Maintrix\data\uploads" -ItemType Directory -Force
New-Item -Path "C:\Maintrix\data\logs" -ItemType Directory -Force
New-Item -Path "C:\Maintrix\config" -ItemType Directory -Force
New-Item -Path "C:\Maintrix\backups" -ItemType Directory -Force
New-Item -Path "C:\Maintrix\scripts" -ItemType Directory -Force

cd C:\Maintrix
```

**2. Configuration Environnement:**
```powershell
# Création du fichier .env.local
@"
# MAINTRIX - Configuration Windows
MAINTRIX_VERSION=2.0.0
DB_PASSWORD=maintrix_secure_windows_2024
SESSION_SECRET=maintrix_session_key_windows_secure_2024
WEB_PORT=8080
DB_PORT=5433
WINDOWS_DEPLOYMENT=true
LOCAL_DEPLOYMENT=true
DISABLE_TELEMETRY=true
"@ | Out-File ".env.local" -Encoding UTF8
```

**3. Copie des Fichiers de Déploiement:**
```powershell
# Copie depuis le dépôt source
Copy-Item "docker-compose.local.yml" "docker-compose.yml"
Copy-Item "Dockerfile" "."

# Copie du code source (si disponible)
Copy-Item "client", "server", "shared" -Destination "." -Recurse
Copy-Item "package*.json", "tsconfig.json", "vite.config.ts" -Destination "."
```

**4. Construction et Démarrage:**
```powershell
# Construction des images
docker-compose build --no-cache

# Démarrage des services
docker-compose up -d maintrix-db
Start-Sleep 30
docker-compose up -d maintrix-app
```

---

## ⚙️ **Configuration Avancée Windows**

### **Intégration Active Directory**

**Configuration LDAP/AD:**
```powershell
# Dans .env.local
@"
# Active Directory
LDAP_ENABLED=true
LDAP_URL=ldap://dc.entreprise.local:389
LDAP_BIND_DN=CN=maintrix-service,OU=Services,DC=entreprise,DC=local
LDAP_BIND_PASSWORD=MotDePasseService
LDAP_SEARCH_BASE=OU=Users,DC=entreprise,DC=local
LDAP_SEARCH_FILTER=(sAMAccountName={username})
"@ | Add-Content ".env.local"
```

### **Configuration SSL avec IIS**

**Reverse Proxy IIS:**
```xml
<!-- web.config pour IIS -->
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="Maintrix Proxy" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:8080/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

### **Service Windows**

**Création du Service:**
```powershell
# Script de service Windows
$serviceName = "Maintrix"
$serviceDisplayName = "Maintrix GMAO Application"
$serviceDescription = "Service de gestion de maintenance Maintrix"
$serviceExecutable = "C:\Maintrix\scripts\maintrix-service.exe"

# Installation du service
New-Service -Name $serviceName -BinaryPathName $serviceExecutable -DisplayName $serviceDisplayName -Description $serviceDescription -StartupType Automatic

# Démarrage du service
Start-Service $serviceName
```

---

## 🛠️ **Gestion et Maintenance Windows**

### **Scripts PowerShell de Gestion**

**Scripts Disponibles:**
- `C:\Maintrix\scripts\start-maintrix.ps1` - Démarrage des services
- `C:\Maintrix\scripts\stop-maintrix.ps1` - Arrêt des services
- `C:\Maintrix\scripts\backup-maintrix.ps1` - Sauvegarde automatique
- `C:\Maintrix\scripts\update-maintrix.ps1` - Mise à jour système
- `C:\Maintrix\scripts\logs-maintrix.ps1` - Consultation des logs

**Utilisation:**
```powershell
# Démarrage
& "C:\Maintrix\scripts\start-maintrix.ps1"

# Arrêt
& "C:\Maintrix\scripts\stop-maintrix.ps1"

# Sauvegarde
& "C:\Maintrix\scripts\backup-maintrix.ps1"

# Mise à jour
& "C:\Maintrix\scripts\update-maintrix.ps1"

# Logs en temps réel
& "C:\Maintrix\scripts\logs-maintrix.ps1"
```

### **Gestion via Docker Desktop**

**Interface Graphique:**
1. Ouvrir Docker Desktop
2. Aller dans "Containers/Apps"
3. Trouver le groupe "maintrix"
4. Contrôler les containers individuellement

**Commandes Docker:**
```powershell
# Statut des containers
docker-compose ps

# Logs applicatifs
docker-compose logs -f maintrix-app

# Logs base de données
docker-compose logs -f maintrix-db

# Redémarrage services
docker-compose restart

# Mise à jour images
docker-compose pull
docker-compose build --no-cache
```

### **Surveillance des Performances**

**PowerShell Performance Monitoring:**
```powershell
# Script de monitoring
while ($true) {
    Clear-Host
    Write-Host "=== MAINTRIX MONITORING ===" -ForegroundColor Green
    
    # Statut containers
    docker-compose ps
    
    # Utilisation ressources
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
    
    # Espace disque
    Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'" | 
        Select-Object @{Name="FreeSpaceGB";Expression={[math]::Round($_.FreeSpace/1GB,2)}}
    
    Start-Sleep 5
}
```

---

## 💾 **Sauvegarde et Restauration Windows**

### **Sauvegarde Automatique avec Tâches Planifiées**

**Création de la Tâche:**
```powershell
# Création de la tâche planifiée
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\Maintrix\scripts\backup-maintrix.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
$settings = New-ScheduledTaskSettingsSet
$task = New-ScheduledTask -Action $action -Trigger $trigger -Settings $settings

Register-ScheduledTask -TaskName "Maintrix Daily Backup" -InputObject $task -User "SYSTEM"
```

**Script de Sauvegarde Avancé:**
```powershell
# backup-maintrix-advanced.ps1
param(
    [string]$BackupType = "full",
    [int]$RetentionDays = 30
)

$backupDir = "C:\Maintrix\backups"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

# Sauvegarde base de données
$dbBackupFile = "$backupDir\maintrix_db_$timestamp.sql"
docker-compose exec -T maintrix-db pg_dump -U maintrix_admin maintrix_local | Out-File $dbBackupFile

# Sauvegarde fichiers uploads
$uploadsBackupFile = "$backupDir\maintrix_uploads_$timestamp.zip"
Compress-Archive -Path "C:\Maintrix\data\uploads\*" -DestinationPath $uploadsBackupFile

# Sauvegarde configuration
$configBackupFile = "$backupDir\maintrix_config_$timestamp.zip"
Compress-Archive -Path "C:\Maintrix\.env.local", "C:\Maintrix\docker-compose.yml" -DestinationPath $configBackupFile

# Nettoyage anciennes sauvegardes
Get-ChildItem $backupDir -Filter "*.sql" | Where-Object CreationTime -lt (Get-Date).AddDays(-$RetentionDays) | Remove-Item
Get-ChildItem $backupDir -Filter "*.zip" | Where-Object CreationTime -lt (Get-Date).AddDays(-$RetentionDays) | Remove-Item

Write-Host "Sauvegarde terminée: $timestamp" -ForegroundColor Green
```

### **Restauration**

**Script de Restauration:**
```powershell
# restore-maintrix.ps1
param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$BackupType = "db"
)

switch ($BackupType) {
    "db" {
        # Restauration base de données
        docker-compose exec -T maintrix-db psql -U maintrix_admin -d maintrix_local -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
        Get-Content $BackupFile | docker-compose exec -T maintrix-db psql -U maintrix_admin -d maintrix_local
    }
    "uploads" {
        # Restauration fichiers
        Remove-Item "C:\Maintrix\data\uploads\*" -Recurse -Force
        Expand-Archive -Path $BackupFile -DestinationPath "C:\Maintrix\data\uploads"
    }
    "config" {
        # Restauration configuration
        Expand-Archive -Path $BackupFile -DestinationPath "C:\Maintrix" -Force
    }
}

Write-Host "Restauration terminée: $BackupType" -ForegroundColor Green
```

---

## 🔒 **Sécurité Windows**

### **Configuration Windows Defender**

**Exclusions Defender:**
```powershell
# Exclusions pour Maintrix
Add-MpPreference -ExclusionPath "C:\Maintrix"
Add-MpPreference -ExclusionPath "C:\Program Files\Docker"
Add-MpPreference -ExclusionPath "$env:USERPROFILE\.docker"

# Exclusions processus
Add-MpPreference -ExclusionProcess "docker.exe"
Add-MpPreference -ExclusionProcess "dockerd.exe"
Add-MpPreference -ExclusionProcess "com.docker.backend.exe"
```

### **Firewall Windows**

**Configuration Firewall:**
```powershell
# Règles firewall pour Maintrix
New-NetFirewallRule -DisplayName "Maintrix Web" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
New-NetFirewallRule -DisplayName "Maintrix Database" -Direction Inbound -Protocol TCP -LocalPort 5433 -Action Allow
New-NetFirewallRule -DisplayName "Docker Desktop" -Direction Inbound -Protocol TCP -LocalPort 2375,2376 -Action Allow

# Restriction par plages IP (optionnel)
New-NetFirewallRule -DisplayName "Maintrix LAN Only" -Direction Inbound -Protocol TCP -LocalPort 8080 -RemoteAddress 192.168.0.0/16,10.0.0.0/8,172.16.0.0/12 -Action Allow
```

### **Chiffrement des Données**

**BitLocker pour le répertoire Maintrix:**
```powershell
# Activation BitLocker sur le lecteur
Enable-BitLocker -MountPoint "C:" -EncryptionMethod XtsAes256 -UsedSpaceOnly

# Sauvegarde clé de récupération
(Get-BitLockerVolume -MountPoint "C:").KeyProtector | Out-File "C:\BitLocker-Recovery-Key.txt"
```

---

## 🚀 **Optimisation Performance Windows**

### **Configuration Docker Desktop**

**Optimisation Ressources:**
```json
{
  "builder": {
    "gc": {
      "enabled": true,
      "defaultKeepStorage": "20GB"
    }
  },
  "experimental": false,
  "features": {
    "buildkit": true
  },
  "hosts": [],
  "insecure-registries": [],
  "ipv6": false,
  "live-restore": true,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "windowsfilter"
}
```

### **Configuration WSL2**

**Optimisation WSL2 (.wslconfig):**
```ini
[wsl2]
memory=8GB
processors=4
swap=2GB
swapFile=C:\\temp\\wsl-swap.vhdx
localhostForwarding=true
nestedVirtualization=true
debugConsole=false
```

### **Optimisation PostgreSQL**

**Configuration PostgreSQL pour Windows:**
```sql
-- Dans le container PostgreSQL
ALTER SYSTEM SET shared_buffers = '512MB';
ALTER SYSTEM SET effective_cache_size = '2GB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
SELECT pg_reload_conf();
```

---

## 🔄 **Mise à Jour et Migration**

### **Mise à Jour Automatique**

**Script de Mise à Jour:**
```powershell
# update-maintrix-auto.ps1
param(
    [switch]$Force,
    [switch]$BackupFirst = $true
)

$maintrixDir = "C:\Maintrix"
Set-Location $maintrixDir

if ($BackupFirst) {
    Write-Host "Création d'une sauvegarde préventive..." -ForegroundColor Yellow
    & ".\scripts\backup-maintrix.ps1"
}

Write-Host "Arrêt des services..." -ForegroundColor Yellow
docker-compose down

Write-Host "Téléchargement des nouvelles images..." -ForegroundColor Blue
docker-compose pull

if ($Force) {
    Write-Host "Reconstruction forcée des images..." -ForegroundColor Blue
    docker-compose build --no-cache --pull
}

Write-Host "Démarrage des services mis à jour..." -ForegroundColor Green
docker-compose up -d

# Vérification santé
Start-Sleep 60
$health = Invoke-WebRequest -Uri "http://localhost:8080/api/health" -UseBasicParsing
if ($health.StatusCode -eq 200) {
    Write-Host "Mise à jour réussie ✓" -ForegroundColor Green
} else {
    Write-Host "Problème détecté après mise à jour ✗" -ForegroundColor Red
}
```

### **Migration de Données**

**Script de Migration:**
```powershell
# migrate-maintrix-data.ps1
param(
    [Parameter(Mandatory=$true)]
    [string]$OldInstallPath,
    [string]$NewInstallPath = "C:\Maintrix"
)

Write-Host "Migration des données Maintrix..." -ForegroundColor Blue

# Arrêt des services
Set-Location $OldInstallPath
docker-compose down

# Copie des données
Copy-Item "$OldInstallPath\data" "$NewInstallPath\data" -Recurse -Force
Copy-Item "$OldInstallPath\backups" "$NewInstallPath\backups" -Recurse -Force
Copy-Item "$OldInstallPath\.env.local" "$NewInstallPath\.env.local" -Force

# Mise à jour des chemins dans docker-compose.yml si nécessaire
$dockerCompose = Get-Content "$NewInstallPath\docker-compose.yml"
$dockerCompose = $dockerCompose -replace [regex]::Escape($OldInstallPath), $NewInstallPath
$dockerCompose | Out-File "$NewInstallPath\docker-compose.yml" -Encoding UTF8

Write-Host "Migration terminée avec succès" -ForegroundColor Green
```

---

## 🐛 **Dépannage Windows**

### **Problèmes Courants**

#### **Docker Desktop ne démarre pas**
```powershell
# Redémarrage des services Docker
Stop-Service "com.docker.service" -Force
Start-Service "com.docker.service"

# Réinitialisation Docker Desktop
& "C:\Program Files\Docker\Docker\Docker Desktop.exe" --reset-to-factory-defaults
```

#### **WSL2 ne fonctionne pas**
```powershell
# Réinitialisation WSL
wsl --shutdown
wsl --unregister Ubuntu-22.04
wsl --install -d Ubuntu-22.04

# Vérification du kernel WSL2
wsl --update
wsl --version
```

#### **Port 8080 déjà utilisé**
```powershell
# Identification du processus
netstat -ano | findstr :8080
Get-Process -Id <PID>

# Changement de port Maintrix
# Modifier WEB_PORT dans .env.local
```

#### **Base de données corrompue**
```powershell
# Réparation PostgreSQL
docker-compose exec maintrix-db psql -U maintrix_admin -d maintrix_local -c "REINDEX DATABASE maintrix_local;"
docker-compose exec maintrix-db psql -U maintrix_admin -d maintrix_local -c "VACUUM FULL;"

# Restauration depuis sauvegarde
& "C:\Maintrix\scripts\restore-maintrix.ps1" -BackupFile "C:\Maintrix\backups\maintrix_db_latest.sql" -BackupType "db"
```

### **Logs et Diagnostic**

**Script de Diagnostic Complet:**
```powershell
# diagnose-maintrix.ps1
Write-Host "=== DIAGNOSTIC MAINTRIX WINDOWS ===" -ForegroundColor Green

# Version Windows
$osInfo = Get-CimInstance Win32_OperatingSystem
Write-Host "OS: $($osInfo.Caption) Build $($osInfo.BuildNumber)"

# État WSL2
Write-Host "`n=== WSL2 ==="
wsl --version
wsl -l -v

# État Docker
Write-Host "`n=== DOCKER ==="
docker --version
docker-compose --version
docker system info

# État des containers
Write-Host "`n=== CONTAINERS ==="
Set-Location "C:\Maintrix"
docker-compose ps

# Utilisation ressources
Write-Host "`n=== RESSOURCES ==="
docker stats --no-stream

# Connectivité réseau
Write-Host "`n=== RÉSEAU ==="
Test-NetConnection -ComputerName localhost -Port 8080
Test-NetConnection -ComputerName localhost -Port 5433

# Espace disque
Write-Host "`n=== STOCKAGE ==="
Get-CimInstance -ClassName Win32_LogicalDisk | 
    Select-Object DeviceID, @{Name="Size(GB)";Expression={[math]::Round($_.Size/1GB,2)}}, @{Name="FreeSpace(GB)";Expression={[math]::Round($_.FreeSpace/1GB,2)}}

# Logs récents
Write-Host "`n=== LOGS RÉCENTS ==="
docker-compose logs --tail 20 maintrix-app
```

---

## 📞 **Support Windows**

### **Ressources Spécifiques Windows**
- **Documentation WSL2**: https://docs.microsoft.com/en-us/windows/wsl/
- **Docker Desktop Windows**: https://docs.docker.com/desktop/windows/
- **PowerShell Docs**: https://docs.microsoft.com/en-us/powershell/

### **Support Technique**
- **Email**: support-windows@maintrix.com
- **Forum**: https://community.maintrix.com/windows
- **Issues**: https://github.com/maintrix/maintrix/issues

### **Formation Windows**
- **Guide PowerShell**: https://training.maintrix.com/powershell
- **Admin Windows**: https://training.maintrix.com/windows-admin
- **Docker sur Windows**: https://training.maintrix.com/docker-windows

---

## 📝 **Licence et Conformité Windows**

### **Licences Microsoft**
- **Windows Server**: Licence serveur requise pour déploiement commercial
- **Docker Desktop**: Licence entreprise requise pour usage commercial
- **WSL2**: Inclus gratuitement avec Windows

### **Conformité Entreprise**
- **Group Policy**: Support configuration centralisée
- **SCCM**: Déploiement automatisé possible
- **Active Directory**: Intégration authentification native

---

**🎯 Installation Windows réussie? Connectez-vous sur http://localhost:8080 avec:**
- **Utilisateur**: admin@maintrix.local
- **Mot de passe**: Maintrix2024!

**⚠️ Pensez à configurer Windows Defender et le firewall pour sécuriser votre installation.**