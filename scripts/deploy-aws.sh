#!/bin/bash
set -e

echo "=========================================="
echo "   Maintrix - Déploiement Amazon AWS"
echo "=========================================="

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Vérification utilisateur root
if [ "$EUID" -eq 0 ]; then
    print_warning "Ne pas exécuter en tant que root. Utilisez un utilisateur avec sudo."
    exit 1
fi

# Variables
APP_DIR="/opt/maintrix"
DOMAIN=""
DB_MODE=""
DB_HOST=""
DB_NAME="maintrix"
DB_USER="maintrix"
DB_PASSWORD=""

echo ""
echo "📋 Configuration de l'installation AWS"
echo "---------------------------------------"

# Choix du mode de base de données
echo ""
echo "Choisissez le mode de base de données:"
echo "  1) AWS RDS PostgreSQL (géré par AWS - recommandé pour production)"
echo "  2) PostgreSQL dans Docker (auto-hébergé - économique)"
read -p "Votre choix [1/2]: " DB_CHOICE

case $DB_CHOICE in
    1)
        DB_MODE="rds"
        print_info "Mode RDS sélectionné"
        read -p "Endpoint RDS (ex: maintrix.xxxxx.us-east-1.rds.amazonaws.com): " DB_HOST
        read -p "Nom de la base de données [maintrix]: " DB_NAME_INPUT
        DB_NAME=${DB_NAME_INPUT:-maintrix}
        read -p "Utilisateur PostgreSQL [maintrix]: " DB_USER_INPUT
        DB_USER=${DB_USER_INPUT:-maintrix}
        read -p "Mot de passe PostgreSQL: " -s DB_PASSWORD
        echo ""
        ;;
    2)
        DB_MODE="docker"
        print_info "Mode Docker PostgreSQL sélectionné"
        DB_HOST="postgres"
        DB_PASSWORD=$(openssl rand -hex 16)
        print_info "Mot de passe PostgreSQL généré automatiquement"
        ;;
    *)
        print_error "Choix invalide"
        exit 1
        ;;
esac

read -p "Nom de domaine (ex: maintrix.votre-domaine.com): " DOMAIN

echo ""
echo "Configuration des paiements (optionnel - appuyez sur Entrée pour ignorer)"
echo "--------------------------------------------------------------------------"
read -p "Clé secrète Stripe (sk_live_...): " -s STRIPE_SECRET_KEY
echo ""
read -p "Clé publique Stripe (pk_live_...): " STRIPE_PUBLISHABLE_KEY
read -p "Client ID PayPal: " PAYPAL_CLIENT_ID
read -p "Client Secret PayPal: " -s PAYPAL_CLIENT_SECRET
echo ""

echo ""
echo "Configuration optionnelle"
echo "-------------------------"
read -p "Clé API SendGrid (pour les emails): " SENDGRID_API_KEY
read -p "Clé API Anthropic (pour le diagnostic IA): " ANTHROPIC_API_KEY

# Mise à jour du système
print_info "Mise à jour du système..."
sudo apt update && sudo apt upgrade -y

# Installation des dépendances
print_info "Installation des dépendances..."
sudo apt install -y \
    git \
    curl \
    nginx \
    certbot \
    python3-certbot-nginx \
    ca-certificates \
    gnupg \
    lsb-release \
    unzip

# Installation Docker
if ! command -v docker &> /dev/null; then
    print_info "Installation de Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    print_success "Docker installé"
else
    print_success "Docker déjà installé"
fi

# Installation Docker Compose
if ! command -v docker-compose &> /dev/null; then
    print_info "Installation de Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    print_success "Docker Compose installé"
fi

# Installation AWS CLI (optionnel mais utile)
if ! command -v aws &> /dev/null; then
    print_info "Installation de AWS CLI..."
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
    print_success "AWS CLI installé"
fi

# Création du répertoire application
print_info "Configuration de l'application..."
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Clonage ou copie de l'application
if [ -d ".git" ]; then
    print_info "Copie des fichiers de l'application..."
    cp -r . $APP_DIR/
else
    read -p "URL du dépôt Git: " GIT_REPO
    git clone $GIT_REPO $APP_DIR
fi

cd $APP_DIR

# Génération de secrets
SESSION_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

# Configuration DATABASE_URL selon le mode
if [ "$DB_MODE" = "rds" ]; then
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}?sslmode=require"
else
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}"
fi

# Création du fichier .env
print_info "Configuration des variables d'environnement..."
cat > .env << EOF
# Base de données
DATABASE_URL=${DATABASE_URL}
PGHOST=${DB_HOST}
PGPORT=5432
PGUSER=${DB_USER}
PGPASSWORD=${DB_PASSWORD}
PGDATABASE=${DB_NAME}

# Session et JWT
SESSION_SECRET=${SESSION_SECRET}
JWT_SECRET=${JWT_SECRET}

# Stripe
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}

# PayPal
PAYPAL_CLIENT_ID=${PAYPAL_CLIENT_ID}
PAYPAL_CLIENT_SECRET=${PAYPAL_CLIENT_SECRET}
PAYPAL_MODE=live

# SendGrid (Emails)
SENDGRID_API_KEY=${SENDGRID_API_KEY}

# Anthropic (IA Diagnostic)
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}

# Application
NODE_ENV=production
PORT=5000

# Domaine
DOMAIN=${DOMAIN}
EOF

print_success "Variables d'environnement configurées"

# Création du docker-compose selon le mode
print_info "Création de la configuration Docker..."

if [ "$DB_MODE" = "rds" ]; then
    # Mode RDS - pas de conteneur PostgreSQL
    cat > docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: maintrix-app
    restart: unless-stopped
    ports:
      - "5000:5000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  uploads:
  logs:
EOF
else
    # Mode Docker - inclut PostgreSQL
    cat > docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: maintrix-app
    restart: unless-stopped
    ports:
      - "5000:5000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  postgres:
    image: postgres:16-alpine
    container_name: maintrix-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${PGUSER}
      POSTGRES_PASSWORD: ${PGPASSWORD}
      POSTGRES_DB: ${PGDATABASE}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${PGUSER} -d ${PGDATABASE}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  uploads:
  logs:
EOF
fi

print_success "Configuration Docker créée"

# Configuration Nginx
print_info "Configuration de Nginx..."
sudo tee /etc/nginx/sites-available/maintrix << EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # Uploads
    client_max_body_size 50M;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
EOF

sudo ln -sf /etc/nginx/sites-available/maintrix /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
print_success "Nginx configuré"

# Construction et démarrage de l'application
print_info "Construction de l'application Docker..."
sudo docker-compose -f docker-compose.prod.yml build

print_info "Démarrage de l'application..."
sudo docker-compose -f docker-compose.prod.yml up -d

# Attente du démarrage
print_info "Attente du démarrage des services..."
sleep 15

# Vérification du statut
if sudo docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    print_success "Application démarrée avec succès"
else
    print_error "Erreur lors du démarrage de l'application"
    sudo docker-compose -f docker-compose.prod.yml logs
    exit 1
fi

# Configuration SSL avec Let's Encrypt
echo ""
read -p "Configurer SSL avec Let's Encrypt? [O/n]: " SSL_CHOICE
if [ "$SSL_CHOICE" != "n" ] && [ "$SSL_CHOICE" != "N" ]; then
    print_info "Configuration du certificat SSL..."
    sudo certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} || {
        print_warning "Échec de la configuration SSL automatique"
        print_info "Exécutez manuellement: sudo certbot --nginx -d ${DOMAIN}"
    }
fi

# Création du service systemd pour redémarrage automatique
print_info "Configuration du démarrage automatique..."
sudo tee /etc/systemd/system/maintrix.service << EOF
[Unit]
Description=Maintrix GMAO Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${APP_DIR}
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable maintrix.service
print_success "Service systemd configuré"

# Script de sauvegarde (pour mode Docker PostgreSQL)
if [ "$DB_MODE" = "docker" ]; then
    print_info "Création du script de sauvegarde..."
    mkdir -p $APP_DIR/backups
    cat > $APP_DIR/backup.sh << 'BACKUP_EOF'
#!/bin/bash
BACKUP_DIR="/opt/maintrix/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker exec maintrix-postgres pg_dump -U maintrix maintrix > $BACKUP_DIR/backup_$DATE.sql
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
echo "Backup créé: backup_$DATE.sql"
BACKUP_EOF
    chmod +x $APP_DIR/backup.sh
    
    # Ajout au cron pour sauvegarde quotidienne
    (crontab -l 2>/dev/null; echo "0 2 * * * $APP_DIR/backup.sh") | crontab -
    print_success "Sauvegarde automatique configurée (quotidienne à 2h)"
fi

# Résumé final
echo ""
echo "=========================================="
echo "   Installation terminée avec succès!"
echo "=========================================="
echo ""
print_success "Maintrix est accessible sur:"
echo "   → http://${DOMAIN}"
if [ "$SSL_CHOICE" != "n" ] && [ "$SSL_CHOICE" != "N" ]; then
    echo "   → https://${DOMAIN}"
fi
echo ""
echo "📋 Commandes utiles:"
echo "   Voir les logs:        docker-compose -f docker-compose.prod.yml logs -f"
echo "   Redémarrer:           docker-compose -f docker-compose.prod.yml restart"
echo "   Arrêter:              docker-compose -f docker-compose.prod.yml down"
echo "   Mettre à jour:        git pull && docker-compose -f docker-compose.prod.yml up -d --build"
if [ "$DB_MODE" = "docker" ]; then
    echo "   Sauvegarder la BDD:   ./backup.sh"
fi
echo ""
echo "📂 Fichiers importants:"
echo "   Application:          ${APP_DIR}"
echo "   Variables d'env:      ${APP_DIR}/.env"
echo "   Logs Nginx:           /var/log/nginx/"
if [ "$DB_MODE" = "docker" ]; then
    echo "   Sauvegardes:          ${APP_DIR}/backups/"
fi
echo ""

if [ "$DB_MODE" = "rds" ]; then
    print_info "Mode RDS: Assurez-vous que le Security Group RDS autorise les connexions depuis cette instance EC2"
fi

print_success "Déploiement AWS terminé!"
