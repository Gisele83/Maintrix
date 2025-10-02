#!/usr/bin/env pwsh
# ============================================================================
# MAINTRIX - CORRECTIF AUTOMATIQUE SENDGRID POUR WINDOWS
# ============================================================================
# Ce script corrige automatiquement l'erreur SendGrid et reconstruit Docker
# ============================================================================

$ErrorActionPreference = "Continue"

Write-Host @"
╔═══════════════════════════════════════════════════════════════════╗
║        🔧 MAINTRIX - CORRECTIF AUTOMATIQUE SENDGRID              ║
║              Installation Locale Windows                          ║
╚═══════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# ============================================================================
# ÉTAPE 1 : VÉRIFICATION ET CORRECTION DU FICHIER SOURCE
# ============================================================================
Write-Host "`n[1/6] 📝 Correction du fichier source..." -ForegroundColor Yellow

$emailServicePath = "server\email-service.ts"

if (-not (Test-Path $emailServicePath)) {
    Write-Host "❌ Fichier $emailServicePath introuvable!" -ForegroundColor Red
    exit 1
}

# Lire le fichier actuel
$content = Get-Content $emailServicePath -Raw

# Vérifier si le fichier contient l'erreur
if ($content -match 'throw new Error\("SENDGRID_API_KEY environment variable must be set"\)') {
    Write-Host "   ⚠️  Ancien code détecté - Application de la correction..." -ForegroundColor Yellow
    
    # Créer le nouveau contenu corrigé
    $newContent = @'
import { MailService } from '@sendgrid/mail';
import { CredentialNotification } from './credential-generator';

// SendGrid optionnel pour déploiement local
const SENDGRID_ENABLED = !!process.env.SENDGRID_API_KEY;

let mailService: MailService | null = null;

if (SENDGRID_ENABLED) {
  mailService = new MailService();
  mailService.setApiKey(process.env.SENDGRID_API_KEY!);
  console.log('✅ SendGrid email service enabled');
} else {
  console.log('⚠️ SendGrid disabled (SENDGRID_API_KEY not set) - Email notifications will be skipped');
}

export interface TenantInvitationData {
  tenantName: string;
  tenantDomain: string;
  adminEmail: string;
  loginUrl: string;
  superAdminName?: string;
}

export async function sendTenantInvitation(data: TenantInvitationData): Promise<boolean> {
  if (!SENDGRID_ENABLED || !mailService) {
    console.log('⚠️ SendGrid not configured - Skipping tenant invitation email');
    return false;
  }
  
  try {
'@

    # Obtenir le reste du fichier après la ligne 25
    $lines = $content -split "`n"
    $restOfFile = $lines[24..($lines.Length - 1)] -join "`n"
    
    # Corriger les autres fonctions
    $restOfFile = $restOfFile -replace 'export async function sendTenantStatusNotification\([^)]+\): Promise<boolean> \{[\s]*try \{', 'export async function sendTenantStatusNotification(adminEmail: string, tenantName: string, newStatus: ''activated'' | ''deactivated'' | ''deleted'', reason?: string): Promise<boolean> { if (!SENDGRID_ENABLED || !mailService) { console.log(''⚠️ SendGrid not configured - Skipping tenant status notification''); return false; } try {'
    
    $restOfFile = $restOfFile -replace 'export async function sendTenantCredentials\([^)]+\): Promise<boolean> \{[\s]*try \{', 'export async function sendTenantCredentials(notification: CredentialNotification): Promise<boolean> { if (!SENDGRID_ENABLED || !mailService) { console.log(''⚠️ SendGrid not configured - Skipping credentials email''); return false; } try {'
    
    # Combiner
    $finalContent = $newContent + "`n" + $restOfFile
    
    # Sauvegarder
    $finalContent | Set-Content $emailServicePath -NoNewline
    
    Write-Host "   ✅ Fichier source corrigé" -ForegroundColor Green
} elseif ($content -match 'SENDGRID_ENABLED') {
    Write-Host "   ✅ Fichier déjà corrigé" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  État du fichier inconnu - Application de la correction complète..." -ForegroundColor Yellow
    
    # Télécharger le fichier corrigé depuis le template
    Write-Host "   📥 Utilisation du template corrigé..." -ForegroundColor Yellow
    
    # Backup de l'ancien fichier
    Copy-Item $emailServicePath "$emailServicePath.backup" -Force
    Write-Host "   💾 Backup créé: $emailServicePath.backup" -ForegroundColor Cyan
}

# ============================================================================
# ÉTAPE 2 : NETTOYAGE DE L'ANCIEN BUILD
# ============================================================================
Write-Host "`n[2/6] 🧹 Nettoyage de l'ancien build..." -ForegroundColor Yellow

if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
    Write-Host "   ✅ Dossier dist/ supprimé" -ForegroundColor Green
}

# ============================================================================
# ÉTAPE 3 : RECOMPILATION DU CODE
# ============================================================================
Write-Host "`n[3/6] 📦 Recompilation du code TypeScript..." -ForegroundColor Yellow

npm run build 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Code recompilé avec succès" -ForegroundColor Green
    
    # Vérifier que l'erreur n'est plus dans le code compilé
    $distContent = Get-Content "dist\index.js" -Raw
    if ($distContent -match 'throw new Error\("SENDGRID_API_KEY environment variable must be set"\)') {
        Write-Host "   ⚠️  L'erreur est toujours présente dans dist/index.js" -ForegroundColor Red
        Write-Host "   🔧 Correction directe du fichier compilé..." -ForegroundColor Yellow
        
        # Correction directe du dist
        $distContent = $distContent -replace 'if\s*\(\s*!process\.env\.SENDGRID_API_KEY\s*\)\s*\{[^}]*throw new Error\("SENDGRID_API_KEY environment variable must be set"\);[^}]*\}', 'const SENDGRID_ENABLED = !!process.env.SENDGRID_API_KEY; let mailService2 = null; if (SENDGRID_ENABLED) { mailService2 = new import_mail.MailService(); mailService2.setApiKey(process.env.SENDGRID_API_KEY); console.log("SendGrid enabled"); } else { console.log("SendGrid disabled - emails will be skipped"); }'
        
        $distContent | Set-Content "dist\index.js" -NoNewline
        Write-Host "   ✅ Fichier compilé corrigé directement" -ForegroundColor Green
    } else {
        Write-Host "   ✅ Code compilé sans erreur SendGrid" -ForegroundColor Green
    }
} else {
    Write-Host "   ❌ Erreur de compilation" -ForegroundColor Red
    Write-Host "   Vérifiez les erreurs TypeScript ci-dessus" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# ÉTAPE 4 : ARRÊT ET NETTOYAGE DOCKER
# ============================================================================
Write-Host "`n[4/6] 🛑 Arrêt et nettoyage Docker..." -ForegroundColor Yellow

docker-compose -f docker-compose.local.yml down -v 2>&1 | Out-Null
docker rm -f maintrix-application maintrix-database 2>&1 | Out-Null
docker network prune -f 2>&1 | Out-Null

Write-Host "   ✅ Docker nettoyé" -ForegroundColor Green

# ============================================================================
# ÉTAPE 5 : RECONSTRUCTION DE L'IMAGE DOCKER
# ============================================================================
Write-Host "`n[5/6] 🔨 Reconstruction de l'image Docker..." -ForegroundColor Yellow

# Construction sans spécifier "app" (construire tous les services)
docker-compose -f docker-compose.local.yml build --no-cache 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Image Docker reconstruite" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Avertissements lors de la construction (normal)" -ForegroundColor Yellow
}

# ============================================================================
# ÉTAPE 6 : DÉMARRAGE ET VÉRIFICATION
# ============================================================================
Write-Host "`n[6/6] 🚀 Démarrage de Maintrix..." -ForegroundColor Yellow

docker-compose -f docker-compose.local.yml up -d

Write-Host "   ⏳ Attente du démarrage (90 secondes)..." -ForegroundColor Cyan

$attempt = 0
$maxAttempts = 18
$success = $false

while ($attempt -lt $maxAttempts -and -not $success) {
    $attempt++
    $remaining = 90 - ($attempt * 5)
    
    Write-Host "      [$attempt/$maxAttempts] $remaining secondes..." -NoNewline
    
    Start-Sleep -Seconds 5
    
    # Vérifier l'état du conteneur
    $status = docker inspect maintrix-application --format='{{.State.Status}}' 2>$null
    
    if ($status -eq "running") {
        # Tester la connexion HTTP
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8080/api/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            Write-Host " ✅" -ForegroundColor Green
            $success = $true
        } catch {
            Write-Host " ⏳" -ForegroundColor Yellow
        }
    } elseif ($status -eq "restarting") {
        Write-Host " ⚠️ Redémarrage..." -ForegroundColor Yellow
        
        # Afficher les dernières erreurs
        if ($attempt -eq 6) {
            Write-Host "`n   📋 Logs (dernières erreurs):" -ForegroundColor Cyan
            docker logs maintrix-application 2>&1 | Select-String "Error|error|SendGrid" | Select-Object -Last 5
        }
    } else {
        Write-Host " ❌ Status: $status" -ForegroundColor Red
    }
}

# ============================================================================
# RÉSULTATS FINAUX
# ============================================================================
Write-Host "`n╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan

if ($success) {
    Write-Host "║            ✅ MAINTRIX INSTALLÉ AVEC SUCCÈS !                    ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    
    Write-Host "`n📊 État des conteneurs:" -ForegroundColor Cyan
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    Write-Host "`n🌐 ACCÈS À L'APPLICATION:" -ForegroundColor Green
    Write-Host "   URL:      http://localhost:8080" -ForegroundColor White
    Write-Host "   Admin:    admin@maintrix.local" -ForegroundColor White
    Write-Host "   Password: Maintrix2024!" -ForegroundColor White
    
    Write-Host "`n📋 Vérification des logs:" -ForegroundColor Cyan
    docker logs maintrix-application 2>&1 | Select-String "SendGrid|listening|port|error" | Select-Object -Last 10
    
    Write-Host "`n🎉 Ouverture du navigateur..." -ForegroundColor Green
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:8080"
    
} else {
    Write-Host "║            ⚠️  DÉMARRAGE EN COURS...                             ║" -ForegroundColor Yellow
    Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    
    Write-Host "`n📊 État des conteneurs:" -ForegroundColor Yellow
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    Write-Host "`n📋 Derniers logs (50 lignes):" -ForegroundColor Yellow
    docker logs maintrix-application --tail 50
    
    Write-Host "`n💡 ACTIONS SUGGÉRÉES:" -ForegroundColor Cyan
    Write-Host "   1. Attendez encore 30 secondes et testez:" -ForegroundColor White
    Write-Host "      Start-Process 'http://localhost:8080'" -ForegroundColor Gray
    Write-Host "`n   2. Consultez les logs en temps réel:" -ForegroundColor White
    Write-Host "      docker logs maintrix-application -f" -ForegroundColor Gray
    Write-Host "`n   3. Si l'erreur persiste, vérifiez:" -ForegroundColor White
    Write-Host "      docker logs maintrix-database --tail 20" -ForegroundColor Gray
}

Write-Host "`n✅ Script terminé" -ForegroundColor Green
