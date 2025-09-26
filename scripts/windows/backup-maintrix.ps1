# 💾 Maintrix Windows - Script de Sauvegarde
# Sauvegarde complète de Maintrix sur Windows

param(
    [string]$InstallDir = "C:\Maintrix",
    [string]$BackupDir = "",
    [string]$BackupType = "full", # full, db, files, config
    [int]$RetentionDays = 30,
    [switch]$Quick,
    [switch]$Compress,
    [switch]$Verbose
)

function Write-ColorOutput {
    param([string]$Message, [string]$Type = "Info")
    switch ($Type) {
        "Success" { Write-Host "[SUCCÈS] $Message" -ForegroundColor Green }
        "Error"   { Write-Host "[ERREUR] $Message" -ForegroundColor Red }
        "Warning" { Write-Host "[ATTENTION] $Message" -ForegroundColor Yellow }
        "Info"    { Write-Host "[INFO] $Message" -ForegroundColor Blue }
    }
}

# Configuration des répertoires
if ([string]::IsNullOrEmpty($BackupDir)) {
    $BackupDir = "$InstallDir\backups"
}

if (-not (Test-Path $BackupDir)) {
    New-Item -Path $BackupDir -ItemType Directory -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPrefix = "maintrix_$BackupType"

Set-Location $InstallDir

Write-ColorOutput "Démarrage sauvegarde Maintrix ($BackupType)..." "Info"

try {
    switch ($BackupType) {
        "db" {
            # Sauvegarde base de données uniquement
            $dbBackupFile = "$BackupDir\${backupPrefix}_${timestamp}.sql"
            Write-ColorOutput "Sauvegarde base de données..." "Info"
            
            docker-compose exec -T maintrix-db pg_dump -U maintrix_admin maintrix_local | Out-File $dbBackupFile -Encoding UTF8
            
            if ($Compress) {
                $compressedFile = "$dbBackupFile.gz"
                # Compression avec 7-Zip si disponible, sinon PowerShell natif
                if (Get-Command 7z -ErrorAction SilentlyContinue) {
                    7z a -tgzip $compressedFile $dbBackupFile
                    Remove-Item $dbBackupFile
                    $dbBackupFile = $compressedFile
                }
            }
            
            Write-ColorOutput "Base de données sauvegardée: $(Split-Path $dbBackupFile -Leaf)" "Success"
        }
        
        "files" {
            # Sauvegarde fichiers uploads
            $filesBackupFile = "$BackupDir\${backupPrefix}_${timestamp}.zip"
            Write-ColorOutput "Sauvegarde fichiers uploads..." "Info"
            
            if (Test-Path "$InstallDir\data\uploads") {
                Compress-Archive -Path "$InstallDir\data\uploads\*" -DestinationPath $filesBackupFile -CompressionLevel Optimal
                Write-ColorOutput "Fichiers sauvegardés: $(Split-Path $filesBackupFile -Leaf)" "Success"
            } else {
                Write-ColorOutput "Aucun fichier upload à sauvegarder" "Warning"
            }
        }
        
        "config" {
            # Sauvegarde configuration
            $configBackupFile = "$BackupDir\${backupPrefix}_${timestamp}.zip"
            Write-ColorOutput "Sauvegarde configuration..." "Info"
            
            $configFiles = @()
            if (Test-Path ".env.local") { $configFiles += ".env.local" }
            if (Test-Path "docker-compose.yml") { $configFiles += "docker-compose.yml" }
            if (Test-Path "config") { $configFiles += "config\*" }
            
            if ($configFiles.Count -gt 0) {
                Compress-Archive -Path $configFiles -DestinationPath $configBackupFile -CompressionLevel Optimal
                Write-ColorOutput "Configuration sauvegardée: $(Split-Path $configBackupFile -Leaf)" "Success"
            } else {
                Write-ColorOutput "Aucun fichier de configuration trouvé" "Warning"
            }
        }
        
        "full" {
            # Sauvegarde complète
            Write-ColorOutput "Sauvegarde complète en cours..." "Info"
            
            # Base de données
            $dbBackupFile = "$BackupDir\maintrix_db_${timestamp}.sql"
            docker-compose exec -T maintrix-db pg_dump -U maintrix_admin maintrix_local | Out-File $dbBackupFile -Encoding UTF8
            
            # Fichiers uploads
            if (Test-Path "$InstallDir\data\uploads") {
                $uploadsBackupFile = "$BackupDir\maintrix_uploads_${timestamp}.zip"
                Compress-Archive -Path "$InstallDir\data\uploads\*" -DestinationPath $uploadsBackupFile -CompressionLevel Optimal
            }
            
            # Configuration
            $configBackupFile = "$BackupDir\maintrix_config_${timestamp}.zip"
            $configFiles = @()
            if (Test-Path ".env.local") { $configFiles += ".env.local" }
            if (Test-Path "docker-compose.yml") { $configFiles += "docker-compose.yml" }
            if (Test-Path "config") { $configFiles += "config" }
            
            if ($configFiles.Count -gt 0) {
                Compress-Archive -Path $configFiles -DestinationPath $configBackupFile -CompressionLevel Optimal
            }
            
            # Logs système (optionnel)
            if (-not $Quick -and (Test-Path "$InstallDir\data\logs")) {
                $logsBackupFile = "$BackupDir\maintrix_logs_${timestamp}.zip"
                Compress-Archive -Path "$InstallDir\data\logs\*" -DestinationPath $logsBackupFile -CompressionLevel Optimal
            }
            
            Write-ColorOutput "Sauvegarde complète terminée" "Success"
        }
        
        default {
            Write-ColorOutput "Type de sauvegarde non reconnu: $BackupType" "Error"
            exit 1
        }
    }
    
    # Nettoyage des anciennes sauvegardes
    if ($RetentionDays -gt 0) {
        Write-ColorOutput "Nettoyage des sauvegardes anciennes (>$RetentionDays jours)..." "Info"
        
        $cutoffDate = (Get-Date).AddDays(-$RetentionDays)
        $oldBackups = Get-ChildItem $BackupDir -Filter "maintrix_*" | Where-Object CreationTime -lt $cutoffDate
        
        foreach ($backup in $oldBackups) {
            Remove-Item $backup.FullName -Force
            if ($Verbose) {
                Write-ColorOutput "Supprimé: $($backup.Name)" "Info"
            }
        }
        
        Write-ColorOutput "Nettoyage terminé - $($oldBackups.Count) fichiers supprimés" "Success"
    }
    
    # Rapport de sauvegarde
    Write-ColorOutput "Sauvegarde $BackupType terminée avec succès - $timestamp" "Success"
    
    # Informations sur l'espace disque
    if ($Verbose) {
        $backupSize = (Get-ChildItem $BackupDir -Filter "maintrix_*$timestamp*" | Measure-Object -Property Length -Sum).Sum
        $backupSizeMB = [math]::Round($backupSize / 1MB, 2)
        Write-ColorOutput "Taille sauvegarde: ${backupSizeMB} MB" "Info"
        
        $diskSpace = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='$($BackupDir.Substring(0,2))'" | 
                     Select-Object @{Name="FreeSpaceGB";Expression={[math]::Round($_.FreeSpace/1GB,2)}}
        Write-ColorOutput "Espace disque disponible: $($diskSpace.FreeSpaceGB) GB" "Info"
    }
}
catch {
    Write-ColorOutput "Erreur lors de la sauvegarde: $($_.Exception.Message)" "Error"
    exit 1
}