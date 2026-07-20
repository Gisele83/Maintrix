#!/bin/bash
set -e

echo "=========================================="
echo "   Maintrix - Déploiement Scaleway"
echo "=========================================="

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "ℹ️  $1"; }

# Vérification utilisateur root
if [ "$EUID" -eq 0 ]; then
    print_warning "Ne pas exécuter en tant que root. Utilisez un utilisateur avec sudo."
    exit 1
fi

# Variables
APP_DIR="/opt/maintrix"
DOMAIN=""
DB_HOST=""
DB_NAME="maintrix"
DB_USER="maintrix"
DB_PASSWORD=""

echo ""
echo "📋 Configuration de l'installation"
echo "-----------------------------------"

read -p "Nom de domaine (ex: maintrix.votre-domaine.com): " DOMAIN
read -p "Host PostgreSQL Scaleway (ex: xxx.pg.scw.cloud): " DB_HOST
read -p "Mot de passe PostgreSQL: " -s DB_PASSWORD
echo ""
read -p "Clé secrète Stripe (sk_live_...): " -s STRIPE_SECRET_KEY
echo ""
read -p "Clé publique Stripe (pk_live_...): " STRIPE_PUBLISHABLE_KEY
read -p "Client ID PayPal: " PAYPAL_CLIENT_ID
read -p "Client Secret PayPal: " -s PAYPAL_CLIENT_SECRET
echo ""

print_info "Mise à jour du système..."
sudo apt update && sudo apt upgrade -y

print_info "Installation des dépendances..."
sudo apt install -y \
    git \
    curl \
    nginx \
    certbot \
    python3-certbot-nginx \
    ca-certificates \
    gnupg \
    lsb-release

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

# Création du fichier .env
print_info "Configuration des variables d'environnement..."
cat > .env << EOF
# Base de données Scaleway Managed PostgreSQL
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}?sslmode=require

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

# Configuration Nginx
print_info "Configuration de Nginx..."
sudo tee /etc/nginx/sites-available/maintrix > /dev/null << EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:5000;
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

    client_max_body_size 50M;
}
EOF

sudo ln -sf /etc/nginx/sites-available/maintrix /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

print_success "Nginx configuré"

# Lancement de l'application avec Docker
print_info "Lancement de l'application..."
sudo docker-compose up -d --build

# Attente du démarrage
sleep 10

# Vérification du statut
if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
    print_success "Application démarrée avec succès"
else
    print_warning "L'application met du temps à démarrer, vérifiez les logs avec: docker-compose logs -f"
fi

# Configuration SSL avec Certbot
print_info "Configuration du certificat SSL..."
sudo certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} || {
    print_warning "Certbot a échoué. Assurez-vous que le DNS pointe vers ce serveur."
    print_info "Vous pouvez réessayer plus tard avec: sudo certbot --nginx -d ${DOMAIN}"
}

# Service systemd pour le redémarrage automatique
print_info "Configuration du service systemd..."
sudo tee /etc/systemd/system/maintrix.service > /dev/null << EOF
[Unit]
Description=Maintrix GMAO Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${APP_DIR}
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
User=${USER}

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable maintrix

print_success "Service systemd configuré"

echo ""
echo "=========================================="
echo "   Installation terminée avec succès!"
echo "=========================================="
echo ""
echo "🌐 Votre application est accessible sur: https://${DOMAIN}"
echo ""
echo "📋 Commandes utiles:"
echo "   - Voir les logs: cd ${APP_DIR} && docker-compose logs -f"
echo "   - Redémarrer: sudo systemctl restart maintrix"
echo "   - Statut: docker-compose ps"
echo ""
echo "🔐 N'oubliez pas de:"
echo "   - Configurer les webhooks Stripe vers https://${DOMAIN}/api/webhooks/stripe"
echo "   - Configurer les webhooks PayPal vers https://${DOMAIN}/api/paypal/webhook"
echo ""
print_success "Déploiement Scaleway terminé!"
