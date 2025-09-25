#!/bin/bash

# 💾 MAINTRIX - Script de Sauvegarde Locale
# Sauvegarde automatique de la base de données et des fichiers

set -e

# =================================
# CONFIGURATION
# =================================
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_BACKUP_FILE="maintrix_db_${DATE}.sql"
FILES_BACKUP_FILE="maintrix_files_${DATE}.tar.gz"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR]${NC} $1"
}

# =================================
# FONCTIONS DE SAUVEGARDE
# =================================

backup_database() {
    log_info "Démarrage de la sauvegarde de la base de données..."
    
    # Vérification de la connectivité
    if ! pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; then
        log_error "Impossible de se connecter à la base de données"
        return 1
    fi
    
    # Sauvegarde avec compression
    if pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
        --verbose --clean --if-exists --no-owner --no-privileges \
        | gzip > "$BACKUP_DIR/$DB_BACKUP_FILE.gz"; then
        
        local size=$(du -h "$BACKUP_DIR/$DB_BACKUP_FILE.gz" | cut -f1)
        log_success "Sauvegarde base de données créée: $DB_BACKUP_FILE.gz ($size)"
        return 0
    else
        log_error "Échec de la sauvegarde de la base de données"
        return 1
    fi
}

backup_files() {
    log_info "Démarrage de la sauvegarde des fichiers..."
    
    local files_to_backup=(
        "/app/uploads"
        "/app/config"
        "/app/data"
    )
    
    local existing_dirs=()
    for dir in "${files_to_backup[@]}"; do
        if [[ -d "$dir" ]]; then
            existing_dirs+=("$dir")
        fi
    done
    
    if [[ ${#existing_dirs[@]} -eq 0 ]]; then
        log_warning "Aucun répertoire de fichiers à sauvegarder"
        return 0
    fi
    
    # Création de l'archive compressée
    if tar -czf "$BACKUP_DIR/$FILES_BACKUP_FILE" -C / "${existing_dirs[@]#/}" >/dev/null 2>&1; then
        local size=$(du -h "$BACKUP_DIR/$FILES_BACKUP_FILE" | cut -f1)
        log_success "Sauvegarde fichiers créée: $FILES_BACKUP_FILE ($size)"
        return 0
    else
        log_error "Échec de la sauvegarde des fichiers"
        return 1
    fi
}

cleanup_old_backups() {
    log_info "Nettoyage des anciennes sauvegardes (rétention: $RETENTION_DAYS jours)..."
    
    local deleted=0
    
    # Suppression des sauvegardes anciennes
    find "$BACKUP_DIR" -name "maintrix_*" -type f -mtime +$RETENTION_DAYS -exec rm -f {} \; -exec echo "Supprimé: {}" \; | while read line; do
        if [[ "$line" == "Supprimé:"* ]]; then
            ((deleted++))
        fi
    done
    
    if [[ $deleted -gt 0 ]]; then
        log_success "Supprimé $deleted anciennes sauvegardes"
    else
        log_info "Aucune ancienne sauvegarde à supprimer"
    fi
}

create_backup_manifest() {
    log_info "Création du manifeste de sauvegarde..."
    
    local manifest_file="$BACKUP_DIR/manifest_${DATE}.json"
    
    cat > "$manifest_file" << EOF
{
    "backup_date": "$(date -Iseconds)",
    "maintrix_version": "${MAINTRIX_VERSION:-unknown}",
    "database_backup": "$DB_BACKUP_FILE.gz",
    "files_backup": "$FILES_BACKUP_FILE",
    "backup_type": "automatic",
    "database_size": "$(stat -c%s "$BACKUP_DIR/$DB_BACKUP_FILE.gz" 2>/dev/null || echo 0)",
    "files_size": "$(stat -c%s "$BACKUP_DIR/$FILES_BACKUP_FILE" 2>/dev/null || echo 0)",
    "retention_days": $RETENTION_DAYS,
    "server_info": {
        "hostname": "$(hostname)",
        "os": "$(uname -a)",
        "docker_version": "$(docker --version 2>/dev/null || echo 'unknown')"
    }
}
EOF
    
    log_success "Manifeste créé: manifest_${DATE}.json"
}

verify_backup() {
    log_info "Vérification de l'intégrité des sauvegardes..."
    
    local errors=0
    
    # Vérification de la sauvegarde base de données
    if [[ -f "$BACKUP_DIR/$DB_BACKUP_FILE.gz" ]]; then
        if gzip -t "$BACKUP_DIR/$DB_BACKUP_FILE.gz" >/dev/null 2>&1; then
            log_success "Sauvegarde base de données valide"
        else
            log_error "Sauvegarde base de données corrompue"
            ((errors++))
        fi
    else
        log_error "Fichier de sauvegarde base de données manquant"
        ((errors++))
    fi
    
    # Vérification de la sauvegarde fichiers
    if [[ -f "$BACKUP_DIR/$FILES_BACKUP_FILE" ]]; then
        if tar -tzf "$BACKUP_DIR/$FILES_BACKUP_FILE" >/dev/null 2>&1; then
            log_success "Sauvegarde fichiers valide"
        else
            log_error "Sauvegarde fichiers corrompue"
            ((errors++))
        fi
    else
        log_warning "Fichier de sauvegarde fichiers manquant (peut être normal)"
    fi
    
    return $errors
}

send_notification() {
    local status="$1"
    local message="$2"
    
    # Envoi d'une notification si configuré
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        if [[ "$status" == "error" ]]; then
            color="danger"
        elif [[ "$status" == "warning" ]]; then
            color="warning"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"text\":\"Maintrix Backup: $message\",\"ts\":$(date +%s)}]}" \
            "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
    fi
    
    # Log local
    case "$status" in
        "success") log_success "$message" ;;
        "warning") log_warning "$message" ;;
        "error") log_error "$message" ;;
        *) log_info "$message" ;;
    esac
}

# =================================
# FONCTION PRINCIPALE
# =================================
main() {
    log_info "Démarrage de la sauvegarde Maintrix"
    log_info "======================================="
    
    # Vérification des répertoires
    mkdir -p "$BACKUP_DIR"
    
    local errors=0
    
    # Sauvegarde de la base de données
    if backup_database; then
        send_notification "success" "Sauvegarde base de données réussie"
    else
        send_notification "error" "Échec sauvegarde base de données"
        ((errors++))
    fi
    
    # Sauvegarde des fichiers
    if backup_files; then
        send_notification "success" "Sauvegarde fichiers réussie"
    else
        send_notification "warning" "Échec sauvegarde fichiers"
    fi
    
    # Nettoyage des anciennes sauvegardes
    cleanup_old_backups
    
    # Création du manifeste
    create_backup_manifest
    
    # Vérification
    if verify_backup; then
        send_notification "success" "Vérification des sauvegardes réussie"
    else
        send_notification "error" "Échec vérification des sauvegardes"
        ((errors++))
    fi
    
    # Résultat final
    if [[ $errors -eq 0 ]]; then
        log_success "Sauvegarde terminée avec succès"
        send_notification "success" "Sauvegarde complète terminée avec succès"
        exit 0
    else
        log_error "Sauvegarde terminée avec $errors erreur(s)"
        send_notification "error" "Sauvegarde terminée avec des erreurs"
        exit 1
    fi
}

# =================================
# GESTION DES ARGUMENTS
# =================================
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --help, -h          Afficher cette aide"
        echo "  --db-only           Sauvegarder seulement la base de données"
        echo "  --files-only        Sauvegarder seulement les fichiers"
        echo "  --verify BACKUP     Vérifier une sauvegarde existante"
        exit 0
        ;;
    --db-only)
        log_info "Mode: Sauvegarde base de données uniquement"
        mkdir -p "$BACKUP_DIR"
        backup_database && log_success "Sauvegarde BDD terminée" || log_error "Échec sauvegarde BDD"
        ;;
    --files-only)
        log_info "Mode: Sauvegarde fichiers uniquement"
        mkdir -p "$BACKUP_DIR"
        backup_files && log_success "Sauvegarde fichiers terminée" || log_error "Échec sauvegarde fichiers"
        ;;
    --verify)
        if [[ -z "${2:-}" ]]; then
            log_error "Spécifiez le fichier de sauvegarde à vérifier"
            exit 1
        fi
        log_info "Vérification de: $2"
        # Logique de vérification...
        ;;
    "")
        main
        ;;
    *)
        log_error "Option inconnue: $1"
        echo "Utilisez --help pour voir les options disponibles"
        exit 1
        ;;
esac