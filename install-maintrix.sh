#!/bin/bash

# 🚀 MAINTRIX - Script d'Installation Locale Automatisée
# Installation complète du progiciel Maintrix sur serveur local
# Compatibilité: Ubuntu/Debian, CentOS/RHEL, macOS

set -e  # Arrêt immédiat en cas d'erreur

# =================================
# VARIABLES DE CONFIGURATION
# =================================
MAINTRIX_VERSION="2.0.0"
INSTALL_DIR="/opt/maintrix"
SERVICE_NAME="maintrix"
DB_PASSWORD=""
WEB_PORT="8080"
DOMAIN_NAME=""

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "Ne pas exécuter ce script en tant que root!"
        log_info "Utilisez: sudo ./install-maintrix.sh"
        exit 1
    fi
}

detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v apt-get >/dev/null 2>&1; then
            OS="ubuntu"
        elif command -v yum >/dev/null 2>&1; then
            OS="centos"
        else
            log_error "Distribution Linux non supportée"
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    else
        log_error "Système d'exploitation non supporté"
        exit 1
    fi
    log_info "Système détecté: $OS"
}

# =================================
# VÉRIFICATIONS PRÉREQUIS
# =================================
check_requirements() {
    log_info "Vérification des prérequis..."
    
    # Vérification de la mémoire (minimum 2GB)
    MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}' 2>/dev/null || echo "0")
    if [[ $MEMORY_GB -lt 2 ]]; then
        log_warning "Mémoire RAM insuffisante détectée (${MEMORY_GB}GB). Minimum recommandé: 2GB"
    fi
    
    # Vérification de l'espace disque (minimum 10GB)
    DISK_SPACE=$(df -BG $(pwd) | awk 'NR==2 {print $4}' | sed 's/G//')
    if [[ $DISK_SPACE -lt 10 ]]; then
        log_error "Espace disque insuffisant (${DISK_SPACE}GB). Minimum requis: 10GB"
        exit 1
    fi
    
    log_success "Prérequis système validés"
}

# =================================
# INSTALLATION DOCKER
# =================================
install_docker() {
    log_info "Installation de Docker..."
    
    if command -v docker >/dev/null 2>&1; then
        log_success "Docker déjà installé"
        return
    fi
    
    case $OS in
        "ubuntu")
            sudo apt-get update
            sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            sudo apt-get update
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        "centos")
            sudo yum install -y yum-utils
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            sudo systemctl start docker
            sudo systemctl enable docker
            ;;
        "macos")
            log_error "Sur macOS, veuillez installer Docker Desktop manuellement"
            log_info "Téléchargez depuis: https://www.docker.com/products/docker-desktop"
            exit 1
            ;;
    esac
    
    # Ajout de l'utilisateur au groupe docker
    sudo usermod -aG docker $USER
    log_success "Docker installé avec succès"
}

install_docker_compose() {
    log_info "Installation de Docker Compose..."
    
    if command -v docker-compose >/dev/null 2>&1; then
        log_success "Docker Compose déjà installé"
        return
    fi
    
    # Installation via package manager ou curl
    case $OS in
        "ubuntu")
            sudo apt-get install -y docker-compose-plugin
            ;;
        "centos")
            sudo yum install -y docker-compose-plugin
            ;;
        "macos")
            # Inclus avec Docker Desktop
            ;;
    esac
    
    log_success "Docker Compose installé"
}

# =================================
# CONFIGURATION INITIALE
# =================================
setup_directories() {
    log_info "Création des répertoires..."
    
    sudo mkdir -p $INSTALL_DIR
    sudo chown $USER:$USER $INSTALL_DIR
    
    mkdir -p $INSTALL_DIR/{data,config,backups,logs}
    mkdir -p $INSTALL_DIR/data/{postgres,uploads,logs}
    mkdir -p $INSTALL_DIR/nginx
    
    log_success "Répertoires créés"
}

generate_passwords() {
    log_info "Génération des mots de passe sécurisés..."
    
    if [[ -z "$DB_PASSWORD" ]]; then
        DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    fi
    
    SESSION_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-50)
    
    log_success "Mots de passe générés"
}

create_env_file() {
    log_info "Création du fichier de configuration..."
    
    cat > $INSTALL_DIR/.env.local << EOF
# =================================
# MAINTRIX - Configuration Locale
# =================================

# Version
MAINTRIX_VERSION=$MAINTRIX_VERSION

# Base de données
DB_PASSWORD=$DB_PASSWORD

# Sécurité
SESSION_SECRET=$SESSION_SECRET

# Ports
WEB_PORT=$WEB_PORT
DB_PORT=5433
PROXY_PORT=80

# Domaine (optionnel)
DOMAIN_NAME=$DOMAIN_NAME

# Sauvegarde
BACKUP_SCHEDULE=0 2 * * *

# APIs optionnelles (à configurer selon besoins)
# ANTHROPIC_API_KEY=sk-ant-xxxxx
# SENDGRID_API_KEY=SG.xxxxx

# Monitoring (désactivé par défaut)
ENABLE_MONITORING=false
EOF
    
    chmod 600 $INSTALL_DIR/.env.local
    log_success "Configuration sauvegardée dans $INSTALL_DIR/.env.local"
}

# =================================
# CONFIGURATION NGINX
# =================================
setup_nginx_config() {
    log_info "Configuration du reverse proxy..."
    
    cat > $INSTALL_DIR/nginx/local.conf << 'EOF'
upstream maintrix_backend {
    server maintrix-app:5000;
}

server {
    listen 80;
    server_name localhost;
    
    client_max_body_size 100M;
    
    # Logs
    access_log /var/log/nginx/maintrix_access.log;
    error_log /var/log/nginx/maintrix_error.log;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # API et application
    location / {
        proxy_pass http://maintrix_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Fichiers statiques
    location /uploads/ {
        alias /var/www/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Health check
    location /health {
        proxy_pass http://maintrix_backend/api/health;
    }
}
EOF
    
    log_success "Configuration Nginx créée"
}

# =================================
# INSTALLATION DE MAINTRIX
# =================================
download_maintrix() {
    log_info "Téléchargement de Maintrix..."
    
    # Copie des fichiers depuis le répertoire courant
    if [[ -f "docker-compose.local.yml" ]]; then
        cp docker-compose.local.yml $INSTALL_DIR/docker-compose.yml
        cp Dockerfile $INSTALL_DIR/
        
        # Copie du code source si disponible
        if [[ -d "client" ]] && [[ -d "server" ]]; then
            cp -r client server shared package*.json tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js drizzle.config.ts components.json $INSTALL_DIR/
            if [[ -d "attached_assets" ]]; then
                cp -r attached_assets $INSTALL_DIR/
            fi
            if [[ -d "mobile" ]]; then
                cp -r mobile $INSTALL_DIR/
            fi
            log_success "Code source copié"
        else
            log_error "Code source de Maintrix non trouvé dans le répertoire courant"
            exit 1
        fi
    else
        log_error "Fichiers de déploiement non trouvés"
        exit 1
    fi
}

build_and_start() {
    log_info "Construction et démarrage de Maintrix..."
    
    cd $INSTALL_DIR
    
    # Chargement des variables d'environnement
    export $(cat .env.local | grep -v '^#' | xargs)
    
    # Construction des images
    docker-compose build --no-cache
    
    # Démarrage des services
    docker-compose up -d maintrix-db
    
    # Attente que la base soit prête
    log_info "Attente de la base de données..."
    sleep 30
    
    # Démarrage de l'application
    docker-compose up -d maintrix-app
    
    # Attente du démarrage complet
    log_info "Démarrage de l'application..."
    sleep 60
    
    log_success "Maintrix démarré avec succès"
}

# =================================
# SCRIPTS DE GESTION
# =================================
create_management_scripts() {
    log_info "Création des scripts de gestion..."
    
    # Script de démarrage
    cat > $INSTALL_DIR/start-maintrix.sh << 'EOF'
#!/bin/bash
cd /opt/maintrix
export $(cat .env.local | grep -v '^#' | xargs)
docker-compose up -d
echo "Maintrix démarré - Accessible sur http://localhost:${WEB_PORT:-8080}"
EOF
    
    # Script d'arrêt
    cat > $INSTALL_DIR/stop-maintrix.sh << 'EOF'
#!/bin/bash
cd /opt/maintrix
docker-compose down
echo "Maintrix arrêté"
EOF
    
    # Script de sauvegarde
    cat > $INSTALL_DIR/backup-maintrix.sh << 'EOF'
#!/bin/bash
cd /opt/maintrix
BACKUP_FILE="maintrix_backup_$(date +%Y%m%d_%H%M%S).sql"
docker-compose exec -T maintrix-db pg_dump -U maintrix_admin maintrix_local > backups/$BACKUP_FILE
echo "Sauvegarde créée: backups/$BACKUP_FILE"
EOF
    
    # Script de mise à jour
    cat > $INSTALL_DIR/update-maintrix.sh << 'EOF'
#!/bin/bash
cd /opt/maintrix
echo "Arrêt de Maintrix..."
docker-compose down
echo "Mise à jour des images..."
docker-compose pull
docker-compose build --no-cache
echo "Redémarrage..."
docker-compose up -d
echo "Mise à jour terminée"
EOF
    
    # Script de logs
    cat > $INSTALL_DIR/logs-maintrix.sh << 'EOF'
#!/bin/bash
cd /opt/maintrix
docker-compose logs -f maintrix-app
EOF
    
    chmod +x $INSTALL_DIR/*.sh
    
    # Liens symboliques dans /usr/local/bin
    sudo ln -sf $INSTALL_DIR/start-maintrix.sh /usr/local/bin/start-maintrix
    sudo ln -sf $INSTALL_DIR/stop-maintrix.sh /usr/local/bin/stop-maintrix
    sudo ln -sf $INSTALL_DIR/backup-maintrix.sh /usr/local/bin/backup-maintrix
    sudo ln -sf $INSTALL_DIR/update-maintrix.sh /usr/local/bin/update-maintrix
    sudo ln -sf $INSTALL_DIR/logs-maintrix.sh /usr/local/bin/logs-maintrix
    
    log_success "Scripts de gestion créés"
}

# =================================
# SERVICE SYSTÈME
# =================================
create_systemd_service() {
    log_info "Création du service système..."
    
    cat > /tmp/maintrix.service << EOF
[Unit]
Description=Maintrix GMAO Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/local/bin/start-maintrix
ExecStop=/usr/local/bin/stop-maintrix
TimeoutStartSec=0
User=$USER
Group=$USER

[Install]
WantedBy=multi-user.target
EOF
    
    sudo mv /tmp/maintrix.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable maintrix
    
    log_success "Service système créé"
}

# =================================
# CONFIGURATION FIREWALL
# =================================
setup_firewall() {
    log_info "Configuration du firewall..."
    
    if command -v ufw >/dev/null 2>&1; then
        sudo ufw allow $WEB_PORT/tcp
        if [[ -n "$DOMAIN_NAME" ]]; then
            sudo ufw allow 80/tcp
            sudo ufw allow 443/tcp
        fi
        log_success "Règles firewall ajoutées"
    else
        log_warning "UFW non installé - configuration firewall manuelle requise"
    fi
}

# =================================
# VÉRIFICATIONS POST-INSTALLATION
# =================================
verify_installation() {
    log_info "Vérification de l'installation..."
    
    # Vérification des conteneurs
    sleep 10
    if docker-compose -f $INSTALL_DIR/docker-compose.yml ps | grep -q "Up"; then
        log_success "Conteneurs démarrés"
    else
        log_error "Problème de démarrage des conteneurs"
        return 1
    fi
    
    # Test de connectivité
    if curl -f http://localhost:$WEB_PORT/api/health >/dev/null 2>&1; then
        log_success "Application accessible"
    else
        log_warning "Application non accessible immédiatement - peut nécessiter plus de temps"
    fi
    
    return 0
}

# =================================
# RAPPORT D'INSTALLATION
# =================================
installation_report() {
    log_success "==================================="
    log_success "  MAINTRIX INSTALLÉ AVEC SUCCÈS"
    log_success "==================================="
    echo
    log_info "🌐 URL d'accès: http://localhost:$WEB_PORT"
    if [[ -n "$DOMAIN_NAME" ]]; then
        log_info "🌐 Domaine: http://$DOMAIN_NAME"
    fi
    echo
    log_info "📋 Informations système:"
    log_info "   Répertoire: $INSTALL_DIR"
    log_info "   Configuration: $INSTALL_DIR/.env.local"
    log_info "   Logs: docker-compose logs -f"
    echo
    log_info "🛠️ Commandes de gestion:"
    log_info "   Démarrer: start-maintrix"
    log_info "   Arrêter: stop-maintrix"
    log_info "   Sauvegarder: backup-maintrix"
    log_info "   Mettre à jour: update-maintrix"
    log_info "   Voir les logs: logs-maintrix"
    echo
    log_info "🔑 Identifiants par défaut:"
    log_info "   Utilisateur: admin@maintrix.local"
    log_info "   Mot de passe: Maintrix2024!"
    echo
    log_warning "⚠️  Changez le mot de passe par défaut lors de la première connexion"
    echo
    log_info "📚 Documentation: $INSTALL_DIR/README.md"
}

# =================================
# FONCTION PRINCIPALE
# =================================
main() {
    echo
    log_info "🚀 MAINTRIX - Installation Locale"
    log_info "=================================="
    echo
    
    # Vérifications initiales
    check_root
    detect_os
    check_requirements
    
    # Configuration interactive
    read -p "Port web pour Maintrix (défaut: 8080): " input_port
    WEB_PORT=${input_port:-8080}
    
    read -p "Nom de domaine (optionnel): " DOMAIN_NAME
    
    read -sp "Mot de passe base de données (optionnel, généré automatiquement): " input_password
    echo
    if [[ -n "$input_password" ]]; then
        DB_PASSWORD=$input_password
    fi
    
    # Installation
    install_docker
    install_docker_compose
    setup_directories
    generate_passwords
    create_env_file
    setup_nginx_config
    download_maintrix
    create_management_scripts
    
    # Construction et démarrage
    build_and_start
    
    # Configuration système
    if [[ "$OS" != "macos" ]]; then
        create_systemd_service
        setup_firewall
    fi
    
    # Vérifications finales
    if verify_installation; then
        installation_report
    else
        log_error "L'installation s'est terminée avec des erreurs"
        log_info "Consultez les logs: logs-maintrix"
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
        echo "  --uninstall         Désinstaller Maintrix"
        echo "  --version           Afficher la version"
        exit 0
        ;;
    --version)
        echo "Maintrix Installer v$MAINTRIX_VERSION"
        exit 0
        ;;
    --uninstall)
        log_info "Désinstallation de Maintrix..."
        cd $INSTALL_DIR 2>/dev/null || true
        docker-compose down 2>/dev/null || true
        sudo systemctl stop maintrix 2>/dev/null || true
        sudo systemctl disable maintrix 2>/dev/null || true
        sudo rm -f /etc/systemd/system/maintrix.service
        sudo rm -f /usr/local/bin/*-maintrix
        sudo rm -rf $INSTALL_DIR
        log_success "Maintrix désinstallé"
        exit 0
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