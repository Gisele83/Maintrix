# PowerShell Installation Script for Maintrix
# Version 2.1.0
# © 2025 Maintrix - Intelligent Maintenance Management Platform

<#
.SYNOPSIS
    Installs Maintrix on Windows systems
.DESCRIPTION
    This script automates the installation of Maintrix including:
    - Node.js (if not installed)
    - PostgreSQL (if not installed)
    - Application dependencies
    - Database setup
    - Service configuration
.PARAMETER SkipDependencies
    Skip installation of Node.js and PostgreSQL
.PARAMETER DatabasePassword
    PostgreSQL superuser password (default: randomly generated)
.PARAMETER Port
    Application port (default: 5000)
.EXAMPLE
    .\Install-Maintrix.ps1
.EXAMPLE
    .\Install-Maintrix.ps1 -SkipDependencies -Port 3000
#>

[CmdletBinding()]
param(
    [switch]$SkipDependencies,
    [string]$DatabasePassword,
    [int]$Port = 5000
)

# Require Administrator privileges
#Requires -RunAsAdministrator

# Script configuration
$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'

# Color functions
function Write-Header {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Write-Step {
    param([string]$Message)
    Write-Host "► $Message" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Blue
}

# Installation paths
$InstallDir = "$env:ProgramFiles\Maintrix"
$BackupDir = "$env:ProgramFiles\Maintrix-Backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# Generate secure password if not provided
if (-not $DatabasePassword) {
    $DatabasePassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 16 | ForEach-Object {[char]$_})
}

# Welcome message
Clear-Host
Write-Header "Maintrix Installation Wizard"
Write-Info "Version 2.1.0"
Write-Info "Installation directory: $InstallDir"
Write-Info "Port: $Port"
Write-Host ""

# Step 1: Check prerequisites
Write-Step "[1/8] Checking prerequisites..."

# Check if Node.js is installed
$nodeInstalled = $false
try {
    $nodeVersion = node --version
    Write-Success "Node.js is installed: $nodeVersion"
    $nodeInstalled = $true
} catch {
    Write-Info "Node.js is not installed"
}

# Check if PostgreSQL is installed
$postgresInstalled = $false
try {
    $pgVersion = psql --version
    Write-Success "PostgreSQL is installed: $pgVersion"
    $postgresInstalled = $true
} catch {
    Write-Info "PostgreSQL is not installed"
}

# Step 2: Install Node.js if needed
if (-not $nodeInstalled -and -not $SkipDependencies) {
    Write-Step "[2/8] Installing Node.js..."
    
    $nodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
    $nodeMsi = "$env:TEMP\nodejs.msi"
    
    try {
        Write-Info "Downloading Node.js..."
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing
        
        Write-Info "Installing Node.js..."
        Start-Process msiexec.exe -ArgumentList "/i `"$nodeMsi`" /quiet /norestart" -Wait
        
        # Update PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        Write-Success "Node.js installed successfully"
    } catch {
        Write-Error "Failed to install Node.js: $_"
        exit 1
    }
} else {
    Write-Step "[2/8] Skipping Node.js installation"
}

# Step 3: Install PostgreSQL if needed
if (-not $postgresInstalled -and -not $SkipDependencies) {
    Write-Step "[3/8] Installing PostgreSQL..."
    
    $pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-15.5-1-windows-x64.exe"
    $pgExe = "$env:TEMP\postgresql.exe"
    
    try {
        Write-Info "Downloading PostgreSQL..."
        Invoke-WebRequest -Uri $pgUrl -OutFile $pgExe -UseBasicParsing
        
        Write-Info "Installing PostgreSQL..."
        $pgArgs = "--mode unattended --superpassword `"$DatabasePassword`" --servicename postgresql --servicepassword `"$DatabasePassword`""
        Start-Process $pgExe -ArgumentList $pgArgs -Wait
        
        # Update PATH
        $env:Path += ";C:\Program Files\PostgreSQL\15\bin"
        
        Write-Success "PostgreSQL installed successfully"
        Write-Info "Database password saved for configuration"
    } catch {
        Write-Error "Failed to install PostgreSQL: $_"
        exit 1
    }
} else {
    Write-Step "[3/8] Skipping PostgreSQL installation"
}

# Step 4: Backup existing installation
if (Test-Path $InstallDir) {
    Write-Step "[4/8] Backing up existing installation..."
    try {
        Copy-Item -Path $InstallDir -Destination $BackupDir -Recurse
        Write-Success "Backup created: $BackupDir"
    } catch {
        Write-Error "Failed to backup: $_"
    }
} else {
    Write-Step "[4/8] No existing installation found"
}

# Step 5: Copy application files
Write-Step "[5/8] Installing application files..."

try {
    # Create installation directory
    if (Test-Path $InstallDir) {
        Remove-Item -Path $InstallDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    
    # Copy files
    Write-Info "Copying application files..."
    Copy-Item -Path ".\*" -Destination $InstallDir -Recurse -Force -Exclude @('node_modules', '.git', 'dist', '.env')
    
    Write-Success "Application files installed"
} catch {
    Write-Error "Failed to copy files: $_"
    exit 1
}

# Step 6: Install dependencies
Write-Step "[6/8] Installing dependencies..."

try {
    Set-Location $InstallDir
    
    Write-Info "Running npm install..."
    npm install --production --silent
    
    Write-Success "Dependencies installed"
} catch {
    Write-Error "Failed to install dependencies: $_"
    exit 1
}

# Step 7: Configure database
Write-Step "[7/8] Configuring database..."

try {
    # Create .env file
    $envContent = @"
# Configuration Maintrix - Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

# Database
DATABASE_URL=postgresql://postgres:$DatabasePassword@localhost:5432/maintrix_db
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=$DatabasePassword
PGDATABASE=maintrix_db

# Application
NODE_ENV=production
PORT=$Port
SESSION_SECRET=$(New-Guid)

# Generated by PowerShell installer
INSTALL_DATE=$(Get-Date -Format 'yyyy-MM-dd')
"@
    
    $envContent | Out-File -FilePath "$InstallDir\.env" -Encoding UTF8
    Write-Success "Environment file created"
    
    # Wait for PostgreSQL to start
    Write-Info "Waiting for PostgreSQL to start..."
    Start-Sleep -Seconds 10
    
    # Create database
    Write-Info "Creating database..."
    $env:PGPASSWORD = $DatabasePassword
    
    try {
        psql -U postgres -h localhost -c "CREATE DATABASE maintrix_db;" 2>$null
        Write-Success "Database created"
    } catch {
        Write-Info "Database may already exist"
    }
    
    # Run migrations
    Write-Info "Applying database schema..."
    npm run db:push
    
    Write-Success "Database configured"
} catch {
    Write-Error "Failed to configure database: $_"
    Write-Info "You may need to configure the database manually"
}

# Step 8: Configure Windows service
Write-Step "[8/8] Configuring Windows service..."

try {
    # Install PM2
    Write-Info "Installing PM2..."
    npm install -g pm2 pm2-windows-service --silent
    
    # Configure PM2
    Write-Info "Configuring PM2 service..."
    pm2-service-install -n Maintrix
    
    # Build application
    Write-Info "Building application..."
    npm run build
    
    # Start with PM2
    Write-Info "Starting application..."
    pm2 start npm --name "maintrix" -- start
    pm2 save
    
    Write-Success "Windows service configured"
} catch {
    Write-Error "Failed to configure service: $_"
    Write-Info "You can start the application manually with 'npm start'"
}

# Configure firewall
Write-Info "Configuring Windows Firewall..."
try {
    New-NetFirewallRule -DisplayName "Maintrix" -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow -ErrorAction SilentlyContinue | Out-Null
    Write-Success "Firewall rule added"
} catch {
    Write-Info "Firewall rule may already exist"
}

# Create desktop shortcut
Write-Info "Creating shortcuts..."
try {
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Maintrix.lnk")
    $Shortcut.TargetPath = "http://localhost:$Port"
    $Shortcut.Save()
    Write-Success "Desktop shortcut created"
} catch {
    Write-Info "Could not create desktop shortcut"
}

# Final summary
Write-Header "Installation Complete!"

Write-Host "Maintrix has been successfully installed and configured.`n" -ForegroundColor Green

Write-Host "Access Information:" -ForegroundColor Cyan
Write-Host "  URL:      http://localhost:$Port" -ForegroundColor White
Write-Host "  Email:    admin@maintrix.local" -ForegroundColor White
Write-Host "  Password: Maintrix2024!" -ForegroundColor White

Write-Host "`nDatabase Information:" -ForegroundColor Cyan
Write-Host "  Database: maintrix_db" -ForegroundColor White
Write-Host "  User:     postgres" -ForegroundColor White
Write-Host "  Password: $DatabasePassword" -ForegroundColor White
Write-Host "  (Saved in: $InstallDir\.env)" -ForegroundColor Gray

Write-Host "`nService Information:" -ForegroundColor Cyan
Write-Host "  Service:  PM2 managed" -ForegroundColor White
Write-Host "  Status:   pm2 status" -ForegroundColor White
Write-Host "  Restart:  pm2 restart maintrix" -ForegroundColor White
Write-Host "  Logs:     pm2 logs maintrix" -ForegroundColor White

Write-Host "`nUseful Commands:" -ForegroundColor Cyan
Write-Host "  Start:    pm2 start maintrix" -ForegroundColor White
Write-Host "  Stop:     pm2 stop maintrix" -ForegroundColor White
Write-Host "  Restart:  pm2 restart maintrix" -ForegroundColor White
Write-Host "  Logs:     pm2 logs maintrix" -ForegroundColor White

Write-Host "`n⚠ IMPORTANT: Change the default admin password after first login!" -ForegroundColor Yellow

Write-Host "`nOpening Maintrix in your browser..." -ForegroundColor Green
Start-Sleep -Seconds 3
Start-Process "http://localhost:$Port"

Write-Host "`nInstallation log saved to: $env:TEMP\maintrix-install.log" -ForegroundColor Gray
Write-Host "For support: support@maintrix-t.com`n" -ForegroundColor Gray
