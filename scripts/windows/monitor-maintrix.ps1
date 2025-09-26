# 📊 Maintrix Windows - Script de Monitoring
# Surveillance en temps réel de Maintrix sur Windows

param(
    [string]$InstallDir = "C:\Maintrix",
    [int]$RefreshSeconds = 5,
    [switch]$LogToFile,
    [switch]$Alert,
    [string]$AlertEmail = "",
    [switch]$Continuous
)

function Write-ColorOutput {
    param([string]$Message, [string]$Type = "Info")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    switch ($Type) {
        "Success" { Write-Host "[$timestamp] [SUCCÈS] $Message" -ForegroundColor Green }
        "Error"   { Write-Host "[$timestamp] [ERREUR] $Message" -ForegroundColor Red }
        "Warning" { Write-Host "[$timestamp] [ATTENTION] $Message" -ForegroundColor Yellow }
        "Info"    { Write-Host "[$timestamp] [INFO] $Message" -ForegroundColor Blue }
        "Critical" { Write-Host "[$timestamp] [CRITIQUE] $Message" -ForegroundColor Magenta }
    }
    
    if ($LogToFile) {
        $logFile = "$InstallDir\logs\monitor_$(Get-Date -Format 'yyyyMMdd').log"
        "[$timestamp] [$Type] $Message" | Add-Content $logFile
    }
}

function Test-MaintrixHealth {
    $healthStatus = @{
        Overall = "Unknown"
        Database = "Unknown"
        Application = "Unknown"
        DiskSpace = "Unknown"
        Memory = "Unknown"
        Network = "Unknown"
    }
    
    try {
        Set-Location $InstallDir
        
        # Test base de données
        try {
            $dbTest = docker-compose exec -T maintrix-db pg_isready -U maintrix_admin 2>$null
            $healthStatus.Database = if ($LASTEXITCODE -eq 0) { "Healthy" } else { "Unhealthy" }
        }
        catch {
            $healthStatus.Database = "Error"
        }
        
        # Test application
        try {
            $webPort = $env:WEB_PORT ?? "8080"
            $response = Invoke-WebRequest -Uri "http://localhost:$webPort/api/health" -UseBasicParsing -TimeoutSec 5
            $healthStatus.Application = if ($response.StatusCode -eq 200) { "Healthy" } else { "Unhealthy" }
        }
        catch {
            $healthStatus.Application = "Unreachable"
        }
        
        # Vérification espace disque
        $diskSpace = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'" | 
                     Select-Object @{Name="FreeSpaceGB";Expression={[math]::Round($_.FreeSpace/1GB,2)}}
        
        $healthStatus.DiskSpace = if ($diskSpace.FreeSpaceGB -gt 5) { "Healthy" } 
                                  elseif ($diskSpace.FreeSpaceGB -gt 2) { "Warning" } 
                                  else { "Critical" }
        
        # Vérification mémoire
        $totalMemory = (Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum
        $availableMemory = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory * 1024
        $memoryUsagePercent = [math]::Round((($totalMemory - $availableMemory) / $totalMemory) * 100, 2)
        
        $healthStatus.Memory = if ($memoryUsagePercent -lt 80) { "Healthy" } 
                               elseif ($memoryUsagePercent -lt 90) { "Warning" } 
                               else { "Critical" }
        
        # Test réseau
        try {
            $networkTest = Test-NetConnection -ComputerName localhost -Port ($env:WEB_PORT ?? "8080") -InformationLevel Quiet
            $healthStatus.Network = if ($networkTest) { "Healthy" } else { "Unhealthy" }
        }
        catch {
            $healthStatus.Network = "Error"
        }
        
        # Statut global
        $criticalIssues = ($healthStatus.Values | Where-Object { $_ -eq "Critical" }).Count
        $unhealthyIssues = ($healthStatus.Values | Where-Object { $_ -in @("Unhealthy", "Error", "Unreachable") }).Count
        
        if ($criticalIssues -gt 0) {
            $healthStatus.Overall = "Critical"
        } elseif ($unhealthyIssues -gt 0) {
            $healthStatus.Overall = "Unhealthy"
        } else {
            $healthStatus.Overall = "Healthy"
        }
    }
    catch {
        $healthStatus.Overall = "Error"
        Write-ColorOutput "Erreur lors du test de santé: $($_.Exception.Message)" "Error"
    }
    
    return $healthStatus
}

function Get-ContainerStats {
    try {
        $stats = docker stats --no-stream --format "json" 2>$null | ConvertFrom-Json
        return $stats
    }
    catch {
        return $null
    }
}

function Send-Alert {
    param([string]$Subject, [string]$Body)
    
    if (-not [string]::IsNullOrEmpty($AlertEmail)) {
        try {
            # Configuration SMTP simple (à adapter selon votre serveur)
            $smtpServer = "localhost"  # Modifier selon votre configuration
            $smtpPort = 25
            
            $message = New-Object System.Net.Mail.MailMessage
            $message.From = "maintrix@$(hostname)"
            $message.To.Add($AlertEmail)
            $message.Subject = $Subject
            $message.Body = $Body
            
            $smtp = New-Object System.Net.Mail.SmtpClient($smtpServer, $smtpPort)
            $smtp.Send($message)
            
            Write-ColorOutput "Alerte envoyée à $AlertEmail" "Info"
        }
        catch {
            Write-ColorOutput "Erreur envoi alerte: $($_.Exception.Message)" "Error"
        }
    }
}

function Show-Dashboard {
    param([hashtable]$Health, [array]$ContainerStats)
    
    Clear-Host
    
    # En-tête
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                    MAINTRIX MONITORING                      ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    # Statut global
    $globalColor = switch ($Health.Overall) {
        "Healthy" { "Green" }
        "Warning" { "Yellow" }
        "Unhealthy" { "Red" }
        "Critical" { "Magenta" }
        default { "Gray" }
    }
    
    Write-Host "🔍 STATUT GLOBAL: " -NoNewline
    Write-Host $Health.Overall -ForegroundColor $globalColor
    Write-Host ""
    
    # Détails santé
    Write-Host "📊 COMPOSANTS:" -ForegroundColor White
    foreach ($component in $Health.Keys) {
        if ($component -ne "Overall") {
            $status = $Health[$component]
            $color = switch ($status) {
                "Healthy" { "Green" }
                "Warning" { "Yellow" }
                "Unhealthy" { "Red" }
                "Critical" { "Magenta" }
                default { "Gray" }
            }
            
            $icon = switch ($component) {
                "Database" { "🗄️ " }
                "Application" { "🚀" }
                "DiskSpace" { "💾" }
                "Memory" { "🧠" }
                "Network" { "🌐" }
                default { "⚡" }
            }
            
            Write-Host "  $icon $component`: " -NoNewline
            Write-Host $status -ForegroundColor $color
        }
    }
    Write-Host ""
    
    # Statistiques containers
    if ($ContainerStats) {
        Write-Host "🐳 CONTAINERS:" -ForegroundColor White
        foreach ($stat in $ContainerStats) {
            if ($stat.Name -match "maintrix") {
                Write-Host "  📦 $($stat.Name)"
                Write-Host "     CPU: $($stat.CPUPerc) | RAM: $($stat.MemUsage) | NET: $($stat.NetIO)" -ForegroundColor Gray
            }
        }
        Write-Host ""
    }
    
    # Ressources système
    $diskSpace = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'" | 
                 Select-Object @{Name="FreeSpaceGB";Expression={[math]::Round($_.FreeSpace/1GB,2)}}, @{Name="TotalSizeGB";Expression={[math]::Round($_.Size/1GB,2)}}
    
    $totalMemory = (Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum / 1GB
    $availableMemory = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB
    $usedMemory = [math]::Round($totalMemory - $availableMemory, 2)
    
    Write-Host "💻 RESSOURCES SYSTÈME:" -ForegroundColor White
    Write-Host "  💾 Disque C: $($diskSpace.FreeSpaceGB)GB libre / $($diskSpace.TotalSizeGB)GB total"
    Write-Host "  🧠 Mémoire: $usedMemory GB utilisée / $([math]::Round($totalMemory, 2)) GB total"
    Write-Host ""
    
    # Horodatage
    Write-Host "🕒 Dernière mise à jour: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    
    if ($Continuous) {
        Write-Host "⏸️  Appuyez sur Ctrl+C pour arrêter..." -ForegroundColor Gray
    }
}

# Script principal
Write-ColorOutput "Démarrage du monitoring Maintrix..." "Info"

if ($Continuous) {
    $lastAlertTime = @{}
    $alertCooldown = 300  # 5 minutes
    
    while ($true) {
        try {
            $health = Test-MaintrixHealth
            $containerStats = Get-ContainerStats
            
            Show-Dashboard -Health $health -ContainerStats $containerStats
            
            # Gestion des alertes
            if ($Alert) {
                foreach ($component in $health.Keys) {
                    if ($health[$component] -in @("Critical", "Unhealthy")) {
                        $alertKey = "$component-$($health[$component])"
                        $currentTime = Get-Date
                        
                        if (-not $lastAlertTime.ContainsKey($alertKey) -or 
                            ($currentTime - $lastAlertTime[$alertKey]).TotalSeconds -gt $alertCooldown) {
                            
                            $alertSubject = "MAINTRIX ALERT: $component - $($health[$component])"
                            $alertBody = @"
ALERTE MAINTRIX

Composant: $component
Statut: $($health[$component])
Horodatage: $currentTime
Serveur: $(hostname)

Statut global: $($health.Overall)
"@
                            
                            Send-Alert -Subject $alertSubject -Body $alertBody
                            $lastAlertTime[$alertKey] = $currentTime
                        }
                    }
                }
            }
            
            Start-Sleep $RefreshSeconds
        }
        catch {
            Write-ColorOutput "Erreur dans la boucle de monitoring: $($_.Exception.Message)" "Error"
            Start-Sleep $RefreshSeconds
        }
    }
} else {
    # Exécution unique
    $health = Test-MaintrixHealth
    $containerStats = Get-ContainerStats
    
    Show-Dashboard -Health $health -ContainerStats $containerStats
    
    Write-ColorOutput "Monitoring terminé" "Info"
}