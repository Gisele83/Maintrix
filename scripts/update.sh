#!/bin/bash

# 🔄 Script de Mise à Jour - Smart GMAO DiagFix
# Mise à jour automatique de l'application en production

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="smart-gmao-diagfix"
BACKUP_BEFORE_UPDATE=true
GIT_REMOTE="origin"
GIT_BRANCH="main"

print_status "=== MISE À JOUR Smart GMAO DiagFix ==="
print_status "Répertoire: $APP_DIR"
print_status "Service: $SERVICE_NAME"

# Vérification des privilèges
if [[ $EUID -ne 0 ]]; then
    print_error "Ce script doit être exécuté avec sudo"
    exit 1
fi

# Chargement de la configuration
if [[ -f "$APP_DIR/.env" ]]; then
    export $(grep -v '^#' "$APP_DIR/.env" | xargs)
else
    print_error "Fichier .env manquant"
    exit 1
fi

# Fonction de rollback
rollback() {
    print_error "Erreur détectée, rollback en cours..."
    
    if [[ -d "$APP_DIR.backup" ]]; then
        print_status "Restauration de la sauvegarde..."
        systemctl stop $SERVICE_NAME || true
        rm -rf "$APP_DIR.temp" || true
        mv "$APP_DIR" "$APP_DIR.temp" || true
        mv "$APP_DIR.backup" "$APP_DIR" || true
        systemctl start $SERVICE_NAME
        print_success "Rollback terminé"
    else
        print_error "Aucune sauvegarde trouvée pour le rollback"
    fi
    exit 1
}

# Gestion des erreurs
trap rollback ERR

# Vérification du statut du service
print_status "Vérification du service..."
if ! systemctl is-active --quiet $SERVICE_NAME; then
    print_warning "Le service n'est pas en cours d'exécution"
    print_status "Tentative de démarrage..."
    systemctl start $SERVICE_NAME
    sleep 5
    if ! systemctl is-active --quiet $SERVICE_NAME; then
        print_error "Impossible de démarrer le service"
        exit 1
    fi
fi

print_success "Service en fonctionnement"

# Sauvegarde avant mise à jour
if [[ "$BACKUP_BEFORE_UPDATE" == "true" ]]; then
    print_status "Sauvegarde avant mise à jour..."
    
    # Sauvegarde de l'application
    if [[ -d "$APP_DIR.backup" ]]; then
        rm -rf "$APP_DIR.backup"
    fi
    cp -r "$APP_DIR" "$APP_DIR.backup"
    
    # Sauvegarde de la base de données
    sudo -u smart-gmao "$APP_DIR/scripts/backup.sh"
    
    print_success "Sauvegarde terminée"
fi

# Arrêt du service
print_status "Arrêt du service $SERVICE_NAME..."
systemctl stop $SERVICE_NAME
print_success "Service arrêté"

# Navigation vers le répertoire de l'application
cd "$APP_DIR"

# Mise à jour du code source
print_status "Mise à jour du code source..."
if [[ -d ".git" ]]; then
    # Sauvegarde des modifications locales
    git stash push -m "Auto-stash before update $(date)"
    
    # Récupération des dernières modifications
    git fetch $GIT_REMOTE
    
    # Vérification s'il y a des mises à jour
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse $GIT_REMOTE/$GIT_BRANCH)
    
    if [[ "$LOCAL" == "$REMOTE" ]]; then
        print_success "Aucune mise à jour disponible"
    else
        print_status "Nouvelles modifications détectées"
        git merge $GIT_REMOTE/$GIT_BRANCH
        print_success "Code source mis à jour"
    fi
else
    print_warning "Repository Git non détecté, mise à jour manuelle requise"
fi

# Mise à jour des dépendances
print_status "Mise à jour des dépendances..."
if [[ -f "package-lock.json" ]]; then
    npm ci --only=production
else
    npm install --only=production
fi
print_success "Dépendances mises à jour"

# Construction de l'application
print_status "Construction de l'application..."
npm run build
print_success "Application construite"

# Migrations de base de données
print_status "Application des migrations de base de données..."
npm run db:push
print_success "Migrations appliquées"

# Vérification de l'intégrité
print_status "Vérification de l'intégrité..."

# Test de la configuration
if [[ ! -f ".env" ]]; then
    print_error "Fichier .env manquant après mise à jour"
    rollback
fi

# Test de la construction
if [[ ! -d "dist" ]]; then
    print_error "Répertoire dist manquant après construction"
    rollback
fi

print_success "Intégrité vérifiée"

# Redémarrage du service
print_status "Redémarrage du service $SERVICE_NAME..."
systemctl start $SERVICE_NAME

# Attendre que le service soit complètement démarré
print_status "Attente du démarrage complet..."
sleep 10

# Vérification du statut
MAX_ATTEMPTS=12
ATTEMPT=1
while [[ $ATTEMPT -le $MAX_ATTEMPTS ]]; do
    if systemctl is-active --quiet $SERVICE_NAME; then
        print_success "Service redémarré avec succès"
        break
    fi
    print_status "Tentative $ATTEMPT/$MAX_ATTEMPTS..."
    sleep 5
    ((ATTEMPT++))
done

if [[ $ATTEMPT -gt $MAX_ATTEMPTS ]]; then
    print_error "Échec du redémarrage du service"
    rollback
fi

# Test de fonctionnement
print_status "Test de fonctionnement..."
sleep 5

# Test de l'API
if curl -f -s "http://localhost:${PORT:-5000}/api/health" >/dev/null; then
    print_success "API accessible"
else
    print_error "API non accessible"
    print_status "Vérification des logs : journalctl -u $SERVICE_NAME -n 50"
    rollback
fi

# Test de la base de données
if sudo -u smart-gmao psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    print_success "Base de données accessible"
else
    print_error "Problème de connexion à la base de données"
    rollback
fi

# Nettoyage des sauvegardes temporaires
if [[ -d "$APP_DIR.backup" ]]; then
    print_status "Conservation de la sauvegarde pré-mise à jour..."
    BACKUP_NAME="$APP_DIR.backup.$(date +%Y%m%d_%H%M%S)"
    mv "$APP_DIR.backup" "$BACKUP_NAME"
    print_status "Sauvegarde conservée dans: $BACKUP_NAME"
fi

# Suppression des anciens fichiers temporaires
rm -rf "$APP_DIR.temp" 2>/dev/null || true

# Affichage des informations de version
print_status "=== INFORMATIONS DE VERSION ==="
if [[ -f "package.json" ]]; then
    VERSION=$(grep '"version"' package.json | cut -d'"' -f4)
    print_status "Version application: $VERSION"
fi

if command -v git >/dev/null && [[ -d ".git" ]]; then
    COMMIT=$(git rev-parse --short HEAD)
    BRANCH=$(git branch --show-current)
    print_status "Commit: $COMMIT"
    print_status "Branche: $BRANCH"
fi

print_status "Node.js: $(node --version)"
print_status "npm: $(npm --version)"

# Logs récents
print_status "=== LOGS RÉCENTS ==="
journalctl -u $SERVICE_NAME -n 10 --no-pager

print_success "=== MISE À JOUR TERMINÉE AVEC SUCCÈS ==="
print_status "Application accessible sur: http://localhost:${PORT:-5000}"
print_status "Statut du service: systemctl status $SERVICE_NAME"
print_status "Logs en temps réel: journalctl -u $SERVICE_NAME -f"

# Désactivation du trap de rollback
trap - ERR

exit 0