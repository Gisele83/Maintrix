#!/bin/bash

# 🚀 MAINTRIX - Démarrage Rapide
# Installation en une seule commande pour démonstration

set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
cat << 'EOF'
╔══════════════════════════════════════╗
║             MAINTRIX                 ║
║     Installation Rapide              ║
║   Where Maintenance Meets Innovation ║
╚══════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${YELLOW}🚀 Démarrage de l'installation rapide de Maintrix...${NC}"
echo

# Vérification Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker non détecté. Installation automatique...${NC}"
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
fi

# Vérification Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker Compose non détecté. Installation...${NC}"
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Installation si le script principal existe
if [[ -f "install-maintrix.sh" ]]; then
    echo -e "${GREEN}✅ Installation complète disponible${NC}"
    echo -e "${BLUE}Lancement de l'installation automatique...${NC}"
    chmod +x install-maintrix.sh
    ./install-maintrix.sh
else
    echo -e "${YELLOW}⚠️  Script d'installation principal non trouvé${NC}"
    echo -e "${BLUE}Installation depuis le répertoire courant...${NC}"
    
    # Configuration minimale rapide
    WEB_PORT=8080
    DB_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/")
    
    # Création de l'environnement minimal
    cat > .env.local << EOF
MAINTRIX_VERSION=2.0.0
DB_PASSWORD=$DB_PASSWORD
WEB_PORT=$WEB_PORT
SESSION_SECRET=$(openssl rand -base64 32 | tr -d "=+/")
NODE_ENV=production
LOCAL_DEPLOYMENT=true
DISABLE_TELEMETRY=true
EOF
    
    # Démarrage avec Docker Compose local
    if [[ -f "docker-compose.local.yml" ]]; then
        echo -e "${GREEN}✅ Démarrage de Maintrix...${NC}"
        docker-compose -f docker-compose.local.yml up -d
        
        echo -e "${GREEN}✅ Installation terminée!${NC}"
        echo
        echo -e "${BLUE}🌐 Maintrix est accessible sur: http://localhost:$WEB_PORT${NC}"
        echo -e "${BLUE}📧 Identifiants par défaut:${NC}"
        echo -e "   Utilisateur: admin@maintrix.local"
        echo -e "   Mot de passe: Maintrix2024!"
        echo
        echo -e "${YELLOW}⚠️  Changez le mot de passe lors de la première connexion${NC}"
    else
        echo -e "${YELLOW}❌ Fichiers de configuration Docker non trouvés${NC}"
        echo -e "${BLUE}Téléchargez l'archive complète depuis https://maintrix-t.com/download${NC}"
    fi
fi

echo
echo -e "${GREEN}🎉 Installation rapide terminée!${NC}"