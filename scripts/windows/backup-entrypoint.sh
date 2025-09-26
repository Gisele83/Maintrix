#!/bin/sh
# Script d'entrée pour les sauvegardes automatiques Windows

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/maintrix_auto_backup_$TIMESTAMP.sql"

# Fonction de log
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [BACKUP] $1"
}

# Création du répertoire de sauvegarde
mkdir -p "$BACKUP_DIR"

# Sauvegarde de la base de données
log "Démarrage de la sauvegarde automatique..."

if pg_dump -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" > "$BACKUP_FILE"; then
    log "Sauvegarde créée avec succès: $(basename "$BACKUP_FILE")"
    
    # Compression si demandée
    if [ "${BACKUP_COMPRESSION:-false}" = "true" ]; then
        gzip "$BACKUP_FILE"
        log "Sauvegarde compressée: $(basename "$BACKUP_FILE.gz")"
    fi
    
    # Nettoyage des anciennes sauvegardes
    if [ -n "${BACKUP_RETENTION_DAYS:-}" ]; then
        find "$BACKUP_DIR" -name "maintrix_auto_backup_*.sql*" -mtime +${BACKUP_RETENTION_DAYS} -delete
        log "Nettoyage des sauvegardes anciennes (>${BACKUP_RETENTION_DAYS} jours)"
    fi
    
    log "Sauvegarde automatique terminée avec succès"
else
    log "ERREUR: Échec de la sauvegarde"
    exit 1
fi