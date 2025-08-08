#!/bin/bash

# 📦 Script de Sauvegarde - Smart GMAO DiagFix
# Sauvegarde automatique de la base de données et des fichiers

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$APP_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$BACKUP_DIR/backup.log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$BACKUP_DIR/backup.log"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$BACKUP_DIR/backup.log"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$BACKUP_DIR/backup.log"
}

# Chargement des variables d'environnement
if [[ -f "$APP_DIR/.env" ]]; then
    export $(grep -v '^#' "$APP_DIR/.env" | xargs)
else
    log_error "Fichier .env manquant dans $APP_DIR"
    exit 1
fi

# Création du répertoire de sauvegarde
mkdir -p "$BACKUP_DIR"

log_info "=== DÉBUT SAUVEGARDE Smart GMAO DiagFix ==="
log_info "Date: $(date)"
log_info "Répertoire: $BACKUP_DIR"

# Sauvegarde de la base de données
log_info "Sauvegarde de la base de données..."
if [[ -n "$DATABASE_URL" ]]; then
    if pg_dump "$DATABASE_URL" > "$BACKUP_DIR/db_backup_$DATE.sql"; then
        # Compression de la sauvegarde
        gzip "$BACKUP_DIR/db_backup_$DATE.sql"
        DB_SIZE=$(du -h "$BACKUP_DIR/db_backup_$DATE.sql.gz" | cut -f1)
        log_success "Base de données sauvegardée: db_backup_$DATE.sql.gz ($DB_SIZE)"
    else
        log_error "Échec de la sauvegarde de la base de données"
        exit 1
    fi
else
    log_error "DATABASE_URL non définie"
    exit 1
fi

# Sauvegarde des fichiers uploads
log_info "Sauvegarde des fichiers uploads..."
if [[ -d "$APP_DIR/uploads" ]]; then
    if tar -czf "$BACKUP_DIR/uploads_backup_$DATE.tar.gz" -C "$APP_DIR" uploads; then
        UPLOADS_SIZE=$(du -h "$BACKUP_DIR/uploads_backup_$DATE.tar.gz" | cut -f1)
        log_success "Fichiers uploads sauvegardés: uploads_backup_$DATE.tar.gz ($UPLOADS_SIZE)"
    else
        log_error "Échec de la sauvegarde des fichiers uploads"
    fi
else
    log_info "Répertoire uploads inexistant, ignoré"
fi

# Sauvegarde des logs
log_info "Sauvegarde des logs..."
if [[ -d "$APP_DIR/logs" ]]; then
    if tar -czf "$BACKUP_DIR/logs_backup_$DATE.tar.gz" -C "$APP_DIR" logs; then
        LOGS_SIZE=$(du -h "$BACKUP_DIR/logs_backup_$DATE.tar.gz" | cut -f1)
        log_success "Logs sauvegardés: logs_backup_$DATE.tar.gz ($LOGS_SIZE)"
    else
        log_error "Échec de la sauvegarde des logs"
    fi
fi

# Sauvegarde de la configuration
log_info "Sauvegarde de la configuration..."
mkdir -p "$BACKUP_DIR/config_$DATE"
cp "$APP_DIR/.env" "$BACKUP_DIR/config_$DATE/" 2>/dev/null || log_info "Fichier .env non trouvé"
cp "$APP_DIR/package.json" "$BACKUP_DIR/config_$DATE/" 2>/dev/null || log_info "Fichier package.json non trouvé"
cp "$APP_DIR/docker-compose.yml" "$BACKUP_DIR/config_$DATE/" 2>/dev/null || log_info "Fichier docker-compose.yml non trouvé"

if tar -czf "$BACKUP_DIR/config_backup_$DATE.tar.gz" -C "$BACKUP_DIR" "config_$DATE"; then
    rm -rf "$BACKUP_DIR/config_$DATE"
    CONFIG_SIZE=$(du -h "$BACKUP_DIR/config_backup_$DATE.tar.gz" | cut -f1)
    log_success "Configuration sauvegardée: config_backup_$DATE.tar.gz ($CONFIG_SIZE)"
fi

# Nettoyage des anciennes sauvegardes
log_info "Nettoyage des anciennes sauvegardes (>$RETENTION_DAYS jours)..."

# Comptage avant nettoyage
OLD_FILES=$(find "$BACKUP_DIR" -name "*.sql.gz" -o -name "*.tar.gz" | wc -l)

# Suppression des anciennes sauvegardes
DELETED_COUNT=0
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete && ((DELETED_COUNT++)) || true
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete && ((DELETED_COUNT++)) || true

# Nettoyage des logs de sauvegarde anciens
find "$BACKUP_DIR" -name "backup.log.*" -mtime +$RETENTION_DAYS -delete || true

NEW_FILES=$(find "$BACKUP_DIR" -name "*.sql.gz" -o -name "*.tar.gz" | wc -l)
CLEANED=$(($OLD_FILES - $NEW_FILES))

if [[ $CLEANED -gt 0 ]]; then
    log_success "Nettoyage terminé: $CLEANED fichiers supprimés"
else
    log_info "Aucun fichier ancien à supprimer"
fi

# Rotation des logs de sauvegarde
if [[ -f "$BACKUP_DIR/backup.log" ]]; then
    LOG_SIZE=$(stat -f%z "$BACKUP_DIR/backup.log" 2>/dev/null || stat -c%s "$BACKUP_DIR/backup.log" 2>/dev/null || echo 0)
    # Si le log fait plus de 10MB, on le fait tourner
    if [[ $LOG_SIZE -gt 10485760 ]]; then
        mv "$BACKUP_DIR/backup.log" "$BACKUP_DIR/backup.log.$(date +%Y%m%d_%H%M%S)"
        log_info "Rotation du fichier de log effectuée"
    fi
fi

# Statistiques finales
log_info "=== STATISTIQUES DE SAUVEGARDE ==="
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
FILE_COUNT=$(find "$BACKUP_DIR" -name "*.gz" | wc -l)
log_info "Taille totale des sauvegardes: $TOTAL_SIZE"
log_info "Nombre de fichiers de sauvegarde: $FILE_COUNT"

# Vérification de l'espace disque disponible
AVAILABLE_SPACE=$(df "$BACKUP_DIR" | awk 'NR==2 {print $4}')
AVAILABLE_GB=$((AVAILABLE_SPACE / 1024 / 1024))
if [[ $AVAILABLE_GB -lt 1 ]]; then
    log_error "Attention: Espace disque faible ($AVAILABLE_GB GB disponible)"
else
    log_info "Espace disque disponible: $AVAILABLE_GB GB"
fi

# Test de l'intégrité de la sauvegarde de base de données
log_info "Test d'intégrité de la sauvegarde..."
if [[ -f "$BACKUP_DIR/db_backup_$DATE.sql.gz" ]]; then
    if zcat "$BACKUP_DIR/db_backup_$DATE.sql.gz" | head -10 | grep -q "PostgreSQL database dump"; then
        log_success "Intégrité de la sauvegarde DB vérifiée"
    else
        log_error "Problème d'intégrité détecté dans la sauvegarde DB"
    fi
fi

log_success "=== SAUVEGARDE TERMINÉE ==="

# Notification optionnelle (webhook, email, etc.)
if [[ -n "$BACKUP_WEBHOOK_URL" ]]; then
    curl -X POST "$BACKUP_WEBHOOK_URL" \
         -H "Content-Type: application/json" \
         -d "{\"text\":\"✅ Sauvegarde Smart GMAO DiagFix terminée: $DATE\"}" \
         &>/dev/null || log_info "Notification webhook échouée"
fi

exit 0