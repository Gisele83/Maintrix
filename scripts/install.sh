#!/bin/bash

# 🚀 Script d'Installation - Maintrix
# Installation automatique pour déploiement local

set -e  # Arrêt en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction d'affichage avec couleurs
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

# Variables globales
INSTALL_DIR="/opt/maintrix"
SERVICE_USER="maintrix"
DB_NAME="maintrix_db"
DB_USER="maintrix_user"
DB_PASSWORD=""

# Fonction de vérification des prérequis
check_prerequisites() {
    print_status "Vérification des prérequis système..."
    
    # Vérification du système d'exploitation
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        print_success "Système Linux détecté"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        print_success "Système macOS détecté"
    else
        print_error "Système d'exploitation non supporté: $OSTYPE"
        exit 1
    fi
    
    # Vérification des privilèges root
    if [[ $EUID -ne 0 ]]; then
        print_error "Ce script doit être exécuté avec les privilèges root (sudo)"
        exit 1
    fi
    
    # Vérification de l'espace disque (minimum 2GB)
    available_space=$(df / | awk 'NR==2 {print $4}')
    required_space=2097152  # 2GB en KB
    
    if [[ $available_space -lt $required_space ]]; then
        print_error "Espace disque insuffisant. Requis: 2GB, Disponible: $((available_space/1024/1024))GB"
        exit 1
    fi
    
    print_success "Prérequis système validés"
}

# Installation de Node.js
install_nodejs() {
    print_status "Installation de Node.js..."
    
    if command -v node &> /dev/null; then
        node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $node_version -ge 18 ]]; then
            print_success "Node.js $(node --version) déjà installé"
            return
        fi
    fi
    
    # Installation via NodeSource
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    
    # Vérification
    if command -v node &> /dev/null && command -v npm &> /dev/null; then
        print_success "Node.js $(node --version) et npm $(npm --version) installés"
    else
        print_error "Échec de l'installation de Node.js"
        exit 1
    fi
}

# Installation de PostgreSQL
install_postgresql() {
    print_status "Installation de PostgreSQL..."
    
    if command -v psql &> /dev/null; then
        print_success "PostgreSQL déjà installé"
        return
    fi
    
    # Installation PostgreSQL
    apt-get update
    apt-get install -y postgresql postgresql-contrib
    
    # Démarrage du service
    systemctl start postgresql
    systemctl enable postgresql
    
    print_success "PostgreSQL installé et démarré"
}

# Configuration de la base de données
setup_database() {
    print_status "Configuration de la base de données..."
    
    # Génération d'un mot de passe sécurisé
    DB_PASSWORD=$(openssl rand -base64 32)
    
    # Création de l'utilisateur et de la base
    sudo -u postgres psql <<EOF
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;
\q
EOF
    
    print_success "Base de données configurée"
    print_status "Utilisateur: $DB_USER"
    print_status "Base: $DB_NAME"
}

# Création de l'utilisateur système
create_system_user() {
    print_status "Création de l'utilisateur système..."
    
    if id "$SERVICE_USER" &>/dev/null; then
        print_success "Utilisateur $SERVICE_USER déjà existant"
        return
    fi
    
    useradd --system --home-dir $INSTALL_DIR --shell /bin/bash $SERVICE_USER
    print_success "Utilisateur $SERVICE_USER créé"
}

# Installation de l'application
install_application() {
    print_status "Installation de Maintrix..."
    
    # Création du répertoire d'installation
    mkdir -p $INSTALL_DIR
    cd $INSTALL_DIR
    
    # Clonage du repository (remplacer par votre URL)
    if [[ ! -d ".git" ]]; then
        print_status "Clonage du repository..."
        # git clone https://github.com/votre-organisation/maintrix.git .
        # Pour l'instant, on copie les fichiers depuis le répertoire courant
        cp -r /path/to/source/* . 2>/dev/null || print_warning "Copiez manuellement les fichiers source"
    fi
    
    # Installation des dépendances
    print_status "Installation des dépendances npm..."
    npm ci --only=production
    
    # Construction de l'application
    print_status "Construction de l'application..."
    npm run build
    
    # Création des répertoires nécessaires
    mkdir -p uploads logs backups
    
    # Configuration des permissions
    chown -R $SERVICE_USER:$SERVICE_USER $INSTALL_DIR
    chmod +x $INSTALL_DIR/scripts/*.sh 2>/dev/null || true
    
    print_success "Application installée"
}

# Configuration de l'environnement
setup_environment() {
    print_status "Configuration de l'environnement..."
    
    # Création du fichier .env
    cat > $INSTALL_DIR/.env <<EOF
# Configuration Maintrix - Générée automatiquement
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
PGHOST=localhost
PGPORT=5432
PGUSER=$DB_USER
PGPASSWORD=$DB_PASSWORD
PGDATABASE=$DB_NAME

NODE_ENV=production
PORT=5000
SESSION_SECRET=$(openssl rand -base64 64)

LOG_LEVEL=info
ALLOWED_ORIGINS=http://localhost:5000

# Stockage
PUBLIC_OBJECT_SEARCH_PATHS="$INSTALL_DIR/uploads/public"
PRIVATE_OBJECT_DIR="$INSTALL_DIR/uploads/private"

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
    
    # Sécurisation du fichier .env
    chown $SERVICE_USER:$SERVICE_USER $INSTALL_DIR/.env
    chmod 600 $INSTALL_DIR/.env
    
    print_success "Fichier d'environnement configuré"
}

# Initialisation de la base de données
initialize_database() {
    print_status "Initialisation de la base de données..."
    
    # Export des variables d'environnement
    export $(grep -v '^#' $INSTALL_DIR/.env | xargs)
    
    # Migration de la base
    cd $INSTALL_DIR
    sudo -u $SERVICE_USER npm run db:push
    
    # Chargement des données de démonstration
    sudo -u $SERVICE_USER npm run seed 2>/dev/null || print_warning "Données de démonstration non chargées"
    
    print_success "Base de données initialisée"
}

# Configuration du service systemd
setup_systemd_service() {
    print_status "Configuration du service systemd..."
    
    cat > /etc/systemd/system/maintrix.service <<EOF
[Unit]
Description=Maintrix - Maintenance Management System
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=/usr/bin/npm start
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=maintrix

# Sécurité
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$INSTALL_DIR/uploads $INSTALL_DIR/logs $INSTALL_DIR/backups

[Install]
WantedBy=multi-user.target
EOF
    
    # Rechargement et activation du service
    systemctl daemon-reload
    systemctl enable maintrix
    
    print_success "Service systemd configuré"
}

# Configuration du firewall
setup_firewall() {
    print_status "Configuration du firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw --force enable
        ufw allow 22/tcp comment 'SSH'
        ufw allow 5000/tcp comment 'Maintrix'
        print_success "Firewall UFW configuré"
    else
        print_warning "UFW non installé, configuration du firewall ignorée"
    fi
}

# Configuration de la sauvegarde automatique
setup_backup() {
    print_status "Configuration des sauvegardes automatiques..."
    
    # Script de sauvegarde
    cat > $INSTALL_DIR/scripts/backup.sh <<'EOF'
#!/bin/bash
# Script de sauvegarde Maintrix

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/maintrix/backups"
source /opt/maintrix/.env

mkdir -p $BACKUP_DIR

# Sauvegarde base de données
pg_dump $DATABASE_URL > $BACKUP_DIR/db_backup_$DATE.sql

# Sauvegarde fichiers uploads
tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz -C /opt/maintrix uploads

# Nettoyage anciennes sauvegardes (>30 jours)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Sauvegarde terminée : $DATE"
EOF
    
    chmod +x $INSTALL_DIR/scripts/backup.sh
    chown $SERVICE_USER:$SERVICE_USER $INSTALL_DIR/scripts/backup.sh
    
    # Ajout au crontab
    (crontab -u $SERVICE_USER -l 2>/dev/null; echo "0 2 * * * $INSTALL_DIR/scripts/backup.sh >> $INSTALL_DIR/logs/backup.log 2>&1") | crontab -u $SERVICE_USER -
    
    print_success "Sauvegardes automatiques configurées (quotidien à 2h)"
}

# Démarrage des services
start_services() {
    print_status "Démarrage des services..."
    
    # Démarrage du service
    systemctl start maintrix
    
    # Vérification du statut
    sleep 5
    if systemctl is-active --quiet maintrix; then
        print_success "Service Maintrix démarré"
    else
        print_error "Échec du démarrage du service"
        print_status "Consultez les logs : journalctl -u maintrix -f"
        exit 1
    fi
}

# Test de l'installation
test_installation() {
    print_status "Test de l'installation..."
    
    # Test de connectivité
    sleep 10
    if curl -f http://localhost:5000/api/health &>/dev/null; then
        print_success "Application accessible sur http://localhost:5000"
    else
        print_warning "Application non accessible, vérifiez les logs"
    fi
    
    # Test de la base de données
    if sudo -u $SERVICE_USER psql $DATABASE_URL -c "SELECT 1;" &>/dev/null; then
        print_success "Base de données accessible"
    else
        print_warning "Problème de connexion à la base de données"
    fi
}

# Affichage des informations finales
display_summary() {
    print_success "Installation terminée avec succès !"
    echo ""
    echo -e "${BLUE}=== INFORMATIONS DE CONNEXION ===${NC}"
    echo -e "URL Application:     ${GREEN}http://localhost:5000${NC}"
    echo -e "Base de données:     ${GREEN}$DB_NAME${NC}"
    echo -e "Utilisateur DB:      ${GREEN}$DB_USER${NC}"
    echo -e "Répertoire install:  ${GREEN}$INSTALL_DIR${NC}"
    echo ""
    echo -e "${BLUE}=== COMMANDES UTILES ===${NC}"
    echo -e "Statut service:      ${YELLOW}sudo systemctl status maintrix${NC}"
    echo -e "Logs application:    ${YELLOW}sudo journalctl -u maintrix -f${NC}"
    echo -e "Redémarrage:         ${YELLOW}sudo systemctl restart maintrix${NC}"
    echo -e "Sauvegarde manuelle: ${YELLOW}sudo -u $SERVICE_USER $INSTALL_DIR/scripts/backup.sh${NC}"
    echo ""
    echo -e "${BLUE}=== SÉCURITÉ ===${NC}"
    echo -e "Mot de passe DB sauvegardé dans: ${YELLOW}$INSTALL_DIR/.env${NC}"
    echo -e "Changez les mots de passe par défaut avant la mise en production"
    echo ""
}

# Fonction principale
main() {
    echo -e "${BLUE}"
    echo "========================================"
    echo "  Maintrix - Installation"
    echo "========================================"
    echo -e "${NC}"
    
    check_prerequisites
    install_nodejs
    install_postgresql
    setup_database
    create_system_user
    install_application
    setup_environment
    initialize_database
    setup_systemd_service
    setup_firewall
    setup_backup
    start_services
    test_installation
    display_summary
}

# Gestion des signaux d'interruption
trap 'print_error "Installation interrompue"; exit 1' INT TERM

# Exécution du script principal
main "$@"