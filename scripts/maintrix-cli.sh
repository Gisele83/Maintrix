#!/bin/bash

# 🛠️ MAINTRIX CLI - Utilitaire de gestion en ligne de commande
# Interface unifiée pour toutes les opérations Maintrix

set -e

# =================================
# CONFIGURATION
# =================================
MAINTRIX_DIR="/opt/maintrix"
COMPOSE_FILE="$MAINTRIX_DIR/docker-compose.yml"
ENV_FILE="$MAINTRIX_DIR/.env.local"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# =================================
# FONCTIONS UTILITAIRES
# =================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo -e "${PURPLE}[MAINTRIX]${NC} $1"
}

check_installation() {
    if [[ ! -d "$MAINTRIX_DIR" ]]; then
        log_error "Maintrix n'est pas installé dans $MAINTRIX_DIR"
        log_info "Utilisez le script d'installation: ./install-maintrix.sh"
        exit 1
    fi
    
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Fichier docker-compose non trouvé: $COMPOSE_FILE"
        exit 1
    fi
}

load_environment() {
    if [[ -f "$ENV_FILE" ]]; then
        export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
    fi
}

# =================================
# COMMANDES DE SERVICE
# =================================
cmd_start() {
    log_header "Démarrage de Maintrix..."
    cd "$MAINTRIX_DIR"
    load_environment
    
    docker-compose up -d
    
    # Attente du démarrage
    log_info "Attente du démarrage des services..."
    sleep 10
    
    # Vérification du statut
    if docker-compose ps | grep -q "Up"; then
        log_success "Maintrix démarré avec succès"
        log_info "Accessible sur: http://localhost:${WEB_PORT:-8080}"
    else
        log_error "Problème de démarrage"
        cmd_logs
    fi
}

cmd_stop() {
    log_header "Arrêt de Maintrix..."
    cd "$MAINTRIX_DIR"
    
    docker-compose down
    log_success "Maintrix arrêté"
}

cmd_restart() {
    log_header "Redémarrage de Maintrix..."
    cmd_stop
    sleep 5
    cmd_start
}

cmd_status() {
    log_header "Statut de Maintrix"
    cd "$MAINTRIX_DIR"
    
    echo
    log_info "Services Docker:"
    docker-compose ps
    
    echo
    log_info "Utilisation des ressources:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    
    echo
    log_info "Espace disque:"
    df -h "$MAINTRIX_DIR"
    
    echo
    if curl -f http://localhost:${WEB_PORT:-8080}/api/health >/dev/null 2>&1; then
        log_success "Application accessible"
    else
        log_warning "Application non accessible"
    fi
}

# =================================
# COMMANDES DE LOGS
# =================================
cmd_logs() {
    log_header "Logs de Maintrix"
    cd "$MAINTRIX_DIR"
    
    case "${2:-all}" in
        "app"|"application")
            docker-compose logs -f maintrix-app
            ;;
        "db"|"database")
            docker-compose logs -f maintrix-db
            ;;
        "nginx"|"proxy")
            docker-compose logs -f maintrix-proxy 2>/dev/null || log_warning "Nginx non démarré"
            ;;
        "all"|*)
            docker-compose logs -f
            ;;
    esac
}

cmd_logs_tail() {
    log_header "Derniers logs (${2:-100} lignes)"
    cd "$MAINTRIX_DIR"
    
    docker-compose logs --tail="${2:-100}"
}

# =================================
# COMMANDES DE SAUVEGARDE
# =================================
cmd_backup() {
    log_header "Sauvegarde de Maintrix..."
    
    case "${2:-full}" in
        "db"|"database")
            bash "$MAINTRIX_DIR/scripts/local-backup.sh" --db-only
            ;;
        "files")
            bash "$MAINTRIX_DIR/scripts/local-backup.sh" --files-only
            ;;
        "full"|*)
            bash "$MAINTRIX_DIR/scripts/local-backup.sh"
            ;;
    esac
}

cmd_restore() {
    if [[ -z "${2:-}" ]]; then
        log_error "Spécifiez le fichier de sauvegarde à restaurer"
        log_info "Usage: maintrix restore <backup_file>"
        exit 1
    fi
    
    log_header "Restauration depuis: $2"
    log_warning "⚠️  Cette opération va écraser les données actuelles!"
    read -p "Continuer? (y/N): " confirm
    
    if [[ "$confirm" != "y" ]] && [[ "$confirm" != "Y" ]]; then
        log_info "Restauration annulée"
        exit 0
    fi
    
    cd "$MAINTRIX_DIR"
    
    # Arrêt temporaire de l'application
    docker-compose stop maintrix-app
    
    # Restauration de la base de données
    if [[ "$2" == *.sql.gz ]]; then
        log_info "Restauration de la base de données..."
        gunzip -c "$2" | docker-compose exec -T maintrix-db psql -U maintrix_admin -d maintrix_local
        log_success "Base de données restaurée"
    elif [[ "$2" == *.tar.gz ]]; then
        log_info "Restauration des fichiers..."
        tar -xzf "$2" -C /
        log_success "Fichiers restaurés"
    else
        log_error "Format de sauvegarde non reconnu"
        exit 1
    fi
    
    # Redémarrage
    docker-compose start maintrix-app
    log_success "Restauration terminée"
}

# =================================
# COMMANDES DE MAINTENANCE
# =================================
cmd_update() {
    log_header "Mise à jour de Maintrix..."
    
    cd "$MAINTRIX_DIR"
    
    # Sauvegarde préventive
    log_info "Sauvegarde préventive..."
    cmd_backup
    
    # Arrêt des services
    docker-compose down
    
    # Mise à jour des images
    log_info "Mise à jour des images Docker..."
    docker-compose pull
    docker-compose build --no-cache
    
    # Redémarrage
    log_info "Redémarrage des services..."
    docker-compose up -d
    
    log_success "Mise à jour terminée"
}

cmd_clean() {
    log_header "Nettoyage du système..."
    
    cd "$MAINTRIX_DIR"
    
    # Arrêt temporaire
    docker-compose down
    
    # Nettoyage Docker
    log_info "Nettoyage des images inutilisées..."
    docker system prune -f
    
    # Nettoyage des logs
    log_info "Rotation des logs..."
    find "$MAINTRIX_DIR/data/logs" -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    # Redémarrage
    docker-compose up -d
    
    log_success "Nettoyage terminé"
}

cmd_reset() {
    log_warning "⚠️  ATTENTION: Cette opération va SUPPRIMER toutes les données!"
    log_warning "Base de données, fichiers uploadés, configuration..."
    echo
    read -p "Tapez 'RESET' pour confirmer: " confirm
    
    if [[ "$confirm" != "RESET" ]]; then
        log_info "Réinitialisation annulée"
        exit 0
    fi
    
    log_header "Réinitialisation de Maintrix..."
    
    cd "$MAINTRIX_DIR"
    
    # Arrêt complet
    docker-compose down -v
    
    # Suppression des données
    sudo rm -rf data/*
    
    # Redémarrage avec base vide
    docker-compose up -d
    
    log_success "Maintrix réinitialisé"
    log_info "Utilisez les identifiants par défaut pour vous connecter"
}

# =================================
# COMMANDES DE CONFIGURATION
# =================================
cmd_config() {
    case "${2:-show}" in
        "show")
            log_header "Configuration actuelle"
            cat "$ENV_FILE"
            ;;
        "edit")
            log_header "Édition de la configuration"
            ${EDITOR:-nano} "$ENV_FILE"
            log_info "Redémarrez Maintrix pour appliquer les changements"
            ;;
        "validate")
            log_header "Validation de la configuration"
            # Validation basique
            if source "$ENV_FILE" 2>/dev/null; then
                log_success "Configuration valide"
            else
                log_error "Configuration invalide"
            fi
            ;;
        *)
            log_error "Usage: maintrix config {show|edit|validate}"
            ;;
    esac
}

cmd_ssl() {
    case "${2:-status}" in
        "status")
            log_header "Statut SSL"
            if [[ -n "${SSL_ENABLED:-}" ]] && [[ "$SSL_ENABLED" == "true" ]]; then
                log_success "SSL activé"
                if [[ -f "${SSL_CERT_PATH:-}" ]]; then
                    log_info "Certificat: ${SSL_CERT_PATH}"
                    openssl x509 -in "$SSL_CERT_PATH" -noout -dates
                else
                    log_warning "Certificat non trouvé"
                fi
            else
                log_info "SSL désactivé"
            fi
            ;;
        "generate")
            log_header "Génération certificat auto-signé"
            mkdir -p "$MAINTRIX_DIR/ssl"
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout "$MAINTRIX_DIR/ssl/maintrix.key" \
                -out "$MAINTRIX_DIR/ssl/maintrix.crt" \
                -subj "/CN=localhost"
            log_success "Certificat généré: $MAINTRIX_DIR/ssl/"
            ;;
        *)
            log_error "Usage: maintrix ssl {status|generate}"
            ;;
    esac
}

# =================================
# COMMANDES D'INFORMATION
# =================================
cmd_info() {
    log_header "Informations système Maintrix"
    
    echo
    log_info "Version: ${MAINTRIX_VERSION:-Inconnue}"
    log_info "Répertoire: $MAINTRIX_DIR"
    log_info "URL: http://localhost:${WEB_PORT:-8080}"
    
    echo
    log_info "Services Docker:"
    cd "$MAINTRIX_DIR"
    docker-compose ps --format "table {{.Name}}\t{{.State}}\t{{.Ports}}"
    
    echo
    log_info "Utilisation disque:"
    du -sh "$MAINTRIX_DIR"/{data,backups} 2>/dev/null || true
    
    echo
    log_info "Dernière sauvegarde:"
    find "$MAINTRIX_DIR/backups" -name "maintrix_db_*.sql.gz" -printf "%T@ %Tc %p\n" 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2- || echo "Aucune sauvegarde trouvée"
}

cmd_help() {
    cat << 'EOF'
🛠️  MAINTRIX CLI - Gestionnaire en ligne de commande

USAGE:
    maintrix <commande> [options]

COMMANDES DE SERVICE:
    start               Démarrer Maintrix
    stop                Arrêter Maintrix
    restart             Redémarrer Maintrix
    status              Afficher le statut des services

COMMANDES DE LOGS:
    logs [service]      Afficher les logs en temps réel
                        Services: app, db, nginx, all (défaut)
    logs-tail [N]       Afficher les N dernières lignes de logs

COMMANDES DE SAUVEGARDE:
    backup [type]       Créer une sauvegarde
                        Types: full (défaut), db, files
    restore <file>      Restaurer depuis une sauvegarde

COMMANDES DE MAINTENANCE:
    update              Mettre à jour Maintrix
    clean               Nettoyer le système
    reset               Réinitialiser complètement (DANGEREUX)

COMMANDES DE CONFIGURATION:
    config show         Afficher la configuration
    config edit         Éditer la configuration
    config validate     Valider la configuration
    ssl status          Statut SSL
    ssl generate        Générer certificat auto-signé

COMMANDES D'INFORMATION:
    info                Informations système
    help                Afficher cette aide

EXEMPLES:
    maintrix start
    maintrix logs app
    maintrix backup db
    maintrix config edit
    maintrix ssl generate

Pour plus d'informations: https://maintrix.com/docs
EOF
}

# =================================
# FONCTION PRINCIPALE
# =================================
main() {
    # Vérification de l'installation
    check_installation
    
    # Chargement de l'environnement
    load_environment
    
    # Gestion des commandes
    case "${1:-help}" in
        "start")            cmd_start ;;
        "stop")             cmd_stop ;;
        "restart")          cmd_restart ;;
        "status")           cmd_status ;;
        "logs")             cmd_logs "$@" ;;
        "logs-tail")        cmd_logs_tail "$@" ;;
        "backup")           cmd_backup "$@" ;;
        "restore")          cmd_restore "$@" ;;
        "update")           cmd_update ;;
        "clean")            cmd_clean ;;
        "reset")            cmd_reset ;;
        "config")           cmd_config "$@" ;;
        "ssl")              cmd_ssl "$@" ;;
        "info")             cmd_info ;;
        "help"|"--help"|"-h") cmd_help ;;
        *)
            log_error "Commande inconnue: $1"
            echo
            cmd_help
            exit 1
            ;;
    esac
}

# Exécution
main "$@"