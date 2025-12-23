#!/bin/bash
set -e

echo "=========================================="
echo "   Maintrix - Déploiement OVH VPS"
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

# Vérification utilisateur
if [ "$EUID" -eq 0 ]; then
    print_warning "Ne pas exécuter en tant que root. Utilisez un utilisateur avec sudo."
    exit 1
fi

# Variables
APP_DIR="/opt/maintrix"
DOMAIN=""
USE_LOCAL_DB="n"

echo ""
echo "📋 Configuration de l'installation OVH"
echo "---------------------------------------"

read -p "Nom de domaine (ex: maintrix.votre-domaine.com): " DOMAIN

echo ""
echo "Base de données PostgreSQL:"
echo "1) PostgreSQL local (installé sur ce serveur)"
echo "2) OVH Public Cloud Databases (externe)"
read -p "Choix [1/2]: " DB_CHOICE

if [ "$DB_CHOICE" = "1" ]; then
    USE_LOCAL_DB="y"
    DB_PASSWORD=$(openssl rand -base64 24)
    print_info "PostgreSQL sera installé localement"
else
    read -p "Host PostgreSQL OVH (ex: postgresql-xxx.database.cloud.ovh.net): " DB_HOST
    read -p "Port PostgreSQL [5432]: " DB_PORT
    DB_PORT=${DB_PORT:-5432}
    read -p "Nom de la base de données [maintrix]: " DB_NAME
    DB_NAME=${DB_NAME:-maintrix}
    read -p "Utilisateur PostgreSQL: " DB_USER
    read -p "Mot de passe PostgreSQL: " -s DB_PASSWORD
    echo ""
fi

echo ""
echo "🔐 Configuration des paiements:"
read -p "Clé secrète Stripe (sk_live_...): " -s STRIPE_SECRET_KEY
echo ""
read -p "Clé publique Stripe (pk_live_...): " STRIPE_PUBLISHABLE_KEY
read -p "Client ID PayPal: " PAYPAL_CLIENT_ID
read -p "Client Secret PayPal: " -s PAYPAL_CLIENT_SECRET
echo ""

# Mise à jour système
print_info "Mise à jour du système..."
sudo apt update && sudo apt upgrade -y

# Installation des dépendances de base
print_info "Installation des dépendances..."
sudo apt install -y \
    git \
    curl \
    wget \
    nginx \
    certbot \
    python3-certbot-nginx \
    ufw \
    fail2ban \
    ca-certificates \
    gnupg

# Configuration du pare-feu OVH
print_info "Configuration du pare-feu..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
print_success "Pare-feu configuré"

# Installation PostgreSQL local si choisi
if [ "$USE_LOCAL_DB" = "y" ]; then
    print_info "Installation de PostgreSQL..."
    sudo apt install -y postgresql postgresql-contrib
    
    # Configuration PostgreSQL
    sudo -u postgres psql << EOF
CREATE USER maintrix WITH PASSWORD '${DB_PASSWORD}';
CREATE DATABASE maintrix OWNER maintrix;
GRANT ALL PRIVILEGES ON DATABASE maintrix TO maintrix;
EOF
    
    DB_HOST="localhost"
    DB_PORT="5432"
    DB_NAME="maintrix"
    DB_USER="maintrix"
    
    print_success "PostgreSQL installé et configuré"
fi

# Installation Node.js 20
print_info "Installation de Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
print_success "Node.js $(node -v) installé"

# Installation PM2 pour la gestion des processus
print_info "Installation de PM2..."
sudo npm install -g pm2
print_success "PM2 installé"

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

# Construction de DATABASE_URL
if [ "$USE_LOCAL_DB" = "y" ]; then
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
else
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require"
fi

# Création du fichier .env
print_info "Configuration des variables d'environnement..."
cat > .env << EOF
# Base de données PostgreSQL
DATABASE_URL=${DATABASE_URL}

# Session et JWT
SESSION_SECRET=${SESSION_SECRET}
JWT_SECRET=${JWT_SECRET}

# Stripe (Production)
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}

# PayPal (Production)
PAYPAL_CLIENT_ID=${PAYPAL_CLIENT_ID}
PAYPAL_CLIENT_SECRET=${PAYPAL_CLIENT_SECRET}
PAYPAL_MODE=live

# Application
NODE_ENV=production
PORT=5000

# Domaine
DOMAIN=${DOMAIN}
EOF

print_success "Fichier .env créé"

# Installation des dépendances Node.js
print_info "Installation des dépendances npm..."
npm ci --production=false

# Build de l'application
print_info "Build de l'application..."
npm run build

# Migration de la base de données
print_info "Migration de la base de données..."
npm run db:push

print_success "Application buildée"

# Configuration PM2
print_info "Configuration de PM2..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'maintrix',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/log/maintrix/error.log',
    out_file: '/var/log/maintrix/out.log',
    merge_logs: true,
    max_memory_restart: '500M'
  }]
};
EOF

# Création du répertoire de logs
sudo mkdir -p /var/log/maintrix
sudo chown $USER:$USER /var/log/maintrix

# Lancement avec PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -1 | sudo bash

print_success "Application lancée avec PM2"

# Configuration Nginx
print_info "Configuration de Nginx..."
sudo tee /etc/nginx/sites-available/maintrix > /dev/null << EOF
upstream maintrix_backend {
    server 127.0.0.1:5000;
    keepalive 64;
}

server {
    listen 80;
    server_name ${DOMAIN};

    # Sécurité
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://maintrix_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        proxy_buffering off;
    }

    # Fichiers statiques
    location /assets {
        alias ${APP_DIR}/dist/public/assets;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    client_max_body_size 50M;

    # Gzip
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;
}
EOF

sudo ln -sf /etc/nginx/sites-available/maintrix /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

print_success "Nginx configuré"

# Configuration SSL
print_info "Configuration du certificat SSL..."
sudo certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} || {
    print_warning "Certbot a échoué. Assurez-vous que le DNS pointe vers ce serveur."
    print_info "Réessayez avec: sudo certbot --nginx -d ${DOMAIN}"
}

# Configuration Fail2ban pour la sécurité
print_info "Configuration de Fail2ban..."
sudo tee /etc/fail2ban/jail.local > /dev/null << EOF
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600

[nginx-http-auth]
enabled = true
EOF

sudo systemctl restart fail2ban
print_success "Fail2ban configuré"

# Script de sauvegarde
print_info "Création du script de sauvegarde..."
sudo tee /usr/local/bin/backup-maintrix.sh > /dev/null << EOF
#!/bin/bash
BACKUP_DIR="/var/backups/maintrix"
DATE=\$(date +%Y%m%d_%H%M%S)
mkdir -p \$BACKUP_DIR

# Sauvegarde base de données
pg_dump ${DATABASE_URL} | gzip > \$BACKUP_DIR/db_\$DATE.sql.gz

# Garder les 7 dernières sauvegardes
ls -t \$BACKUP_DIR/db_*.sql.gz | tail -n +8 | xargs -r rm

echo "Sauvegarde terminée: \$BACKUP_DIR/db_\$DATE.sql.gz"
EOF

sudo chmod +x /usr/local/bin/backup-maintrix.sh

# Cron pour sauvegarde quotidienne
(crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/backup-maintrix.sh") | crontab -

print_success "Sauvegardes automatiques configurées"

echo ""
echo "=========================================="
echo "   Installation OVH terminée!"
echo "=========================================="
echo ""
echo "🌐 Votre application: https://${DOMAIN}"
echo ""
echo "📋 Commandes utiles:"
echo "   - Logs: pm2 logs maintrix"
echo "   - Statut: pm2 status"
echo "   - Redémarrer: pm2 restart maintrix"
echo "   - Monitoring: pm2 monit"
echo ""
echo "🔐 Configuration webhooks:"
echo "   - Stripe: https://${DOMAIN}/api/webhooks/stripe"
echo "   - PayPal: https://${DOMAIN}/api/paypal/webhook"
echo ""
if [ "$USE_LOCAL_DB" = "y" ]; then
    echo "🗄️ Base de données locale:"
    echo "   - Mot de passe PostgreSQL: ${DB_PASSWORD}"
    echo "   (Conservez ce mot de passe en lieu sûr!)"
    echo ""
fi
echo "💾 Sauvegarde: /usr/local/bin/backup-maintrix.sh"
echo ""
print_success "Déploiement OVH terminé!"
