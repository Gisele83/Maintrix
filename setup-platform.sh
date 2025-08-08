#!/bin/bash

# 🚀 Smart GMAO DiagFix - Setup Platform Distribution
# Script de mise en place pour distribution de la plateforme

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}"
    echo "=================================================================="
    echo "  🚀 Smart GMAO DiagFix - Platform Distribution Setup"
    echo "=================================================================="
    echo -e "${NC}"
}

print_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
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

print_info() {
    echo -e "${PURPLE}[INFO]${NC} $1"
}

# Configuration
DISTRIBUTION_DIR="smart-gmao-diagfix-distribution"
VERSION="2.1.0"
BUILD_DATE=$(date +"%Y%m%d_%H%M%S")

print_header

print_step "Initialisation du setup de distribution..."

# Vérification des prérequis
print_step "Vérification des prérequis..."
if ! command -v node >/dev/null 2>&1; then
    print_error "Node.js n'est pas installé"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    print_error "npm n'est pas installé"
    exit 1
fi

print_success "Prérequis vérifiés"

# Création du répertoire de distribution
print_step "Création du répertoire de distribution..."
if [[ -d "$DISTRIBUTION_DIR" ]]; then
    print_warning "Répertoire existant, suppression..."
    rm -rf "$DISTRIBUTION_DIR"
fi

mkdir -p "$DISTRIBUTION_DIR"
print_success "Répertoire créé: $DISTRIBUTION_DIR"

# Construction de l'application
print_step "Construction de l'application..."
npm run build
print_success "Application construite"

# Copie des fichiers essentiels
print_step "Copie des fichiers de distribution..."

# Structure principale
cp -r dist "$DISTRIBUTION_DIR/"
cp -r scripts "$DISTRIBUTION_DIR/"
cp -r mobile "$DISTRIBUTION_DIR/"

# Fichiers de configuration
cp package.json "$DISTRIBUTION_DIR/"
cp package-lock.json "$DISTRIBUTION_DIR/"
cp .env.example "$DISTRIBUTION_DIR/"
cp Dockerfile "$DISTRIBUTION_DIR/"
cp docker-compose.yml "$DISTRIBUTION_DIR/"
cp smart-gmao-diagfix.service "$DISTRIBUTION_DIR/"

# Documentation
cp GUIDE_DEMARRAGE_RAPIDE.md "$DISTRIBUTION_DIR/"
cp INSTALLATION_LOCALE.md "$DISTRIBUTION_DIR/"
cp DOCUMENTATION_COMPLETE_SMART_GMAO_DIAGFIX.md "$DISTRIBUTION_DIR/"
cp README.md "$DISTRIBUTION_DIR/" 2>/dev/null || echo "# Smart GMAO DiagFix" > "$DISTRIBUTION_DIR/README.md"

print_success "Fichiers copiés"

# Création du manifeste de distribution
print_step "Création du manifeste de distribution..."
cat > "$DISTRIBUTION_DIR/DISTRIBUTION_MANIFEST.json" << EOF
{
  "name": "Smart GMAO DiagFix",
  "version": "$VERSION",
  "buildDate": "$BUILD_DATE",
  "type": "enterprise_distribution",
  "components": {
    "application": {
      "frontend": "React 18 + TypeScript",
      "backend": "Node.js + Express",
      "database": "PostgreSQL",
      "mobile": "React Native"
    },
    "deployment": {
      "docker": "Available",
      "systemd": "Service included",
      "nginx": "Configuration provided",
      "ssl": "Let's Encrypt ready"
    },
    "features": [
      "Smart Diagnostic AI",
      "GMAO Platform",
      "Mobile Application",
      "IoT Integration",
      "Predictive Maintenance",
      "Offline Capabilities"
    ]
  },
  "requirements": {
    "minimum": {
      "cpu": "2 cores",
      "memory": "4 GB",
      "storage": "20 GB",
      "os": "Ubuntu 20.04+"
    },
    "recommended": {
      "cpu": "4 cores",
      "memory": "8 GB",
      "storage": "50 GB SSD",
      "os": "Ubuntu 22.04 LTS"
    }
  },
  "installation": {
    "methods": ["automatic", "docker", "manual"],
    "estimatedTime": "5-15 minutes",
    "supportedPlatforms": ["Linux", "Docker", "Cloud"]
  }
}
EOF

print_success "Manifeste créé"

# Rendre les scripts exécutables
print_step "Configuration des permissions..."
chmod +x "$DISTRIBUTION_DIR/scripts/"*.sh
print_success "Permissions configurées"

# Création de checksums
print_step "Génération des checksums de sécurité..."
cd "$DISTRIBUTION_DIR"

# Checksum des scripts critiques
sha256sum scripts/install.sh > checksums.txt
sha256sum scripts/start.sh >> checksums.txt
sha256sum scripts/backup.sh >> checksums.txt
sha256sum scripts/update.sh >> checksums.txt
sha256sum GUIDE_DEMARRAGE_RAPIDE.md >> checksums.txt

cd ..
print_success "Checksums générés"

# Création de l'archive de distribution
print_step "Création de l'archive de distribution..."
ARCHIVE_NAME="smart-gmao-diagfix-v${VERSION}-${BUILD_DATE}.tar.gz"

tar -czf "$ARCHIVE_NAME" "$DISTRIBUTION_DIR"
print_success "Archive créée: $ARCHIVE_NAME"

# Calcul de la taille
ARCHIVE_SIZE=$(du -h "$ARCHIVE_NAME" | cut -f1)
print_info "Taille de l'archive: $ARCHIVE_SIZE"

# Création du script d'installation automatique
print_step "Création du script d'installation automatique..."
cat > "install-smart-gmao-diagfix.sh" << 'EOF'
#!/bin/bash

# 🚀 Smart GMAO DiagFix - Installation Automatique
# Script d'installation one-line pour la plateforme

set -e

# Configuration
DOWNLOAD_URL="https://releases.smart-gmao-diagfix.com/latest"
INSTALL_DIR="/opt/smart-gmao-diagfix"
SERVICE_USER="smart-gmao"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() { echo -e "${BLUE}[STEP]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo -e "${BLUE}🚀 Installation Smart GMAO DiagFix${NC}"

# Vérification des privilèges
if [[ $EUID -ne 0 ]]; then
    print_error "Ce script doit être exécuté avec sudo"
    exit 1
fi

# Mise à jour du système
print_step "Mise à jour du système..."
apt update && apt upgrade -y

# Installation des prérequis
print_step "Installation des prérequis..."
apt install -y curl wget git nginx postgresql postgresql-contrib nodejs npm

# Téléchargement et installation
print_step "Téléchargement de Smart GMAO DiagFix..."
cd /tmp
wget -O smart-gmao-diagfix.tar.gz "$DOWNLOAD_URL"
tar -xzf smart-gmao-diagfix.tar.gz
mv smart-gmao-diagfix-distribution "$INSTALL_DIR"

# Exécution du script d'installation
print_step "Installation de la plateforme..."
cd "$INSTALL_DIR"
./scripts/install.sh

print_success "Smart GMAO DiagFix installé avec succès!"
print_step "Accès: http://localhost:5000"
print_step "Documentation: $INSTALL_DIR/GUIDE_DEMARRAGE_RAPIDE.md"
EOF

chmod +x install-smart-gmao-diagfix.sh
print_success "Script d'installation automatique créé"

# Création du package mobile
print_step "Préparation du package mobile..."
if [[ -d "mobile" ]]; then
    cd mobile
    
    # Package Android
    if [[ -d "android" ]]; then
        print_step "Création du package Android..."
        mkdir -p "../$DISTRIBUTION_DIR/mobile-packages"
        
        # Copie des fichiers essentiels du mobile
        cp -r . "../$DISTRIBUTION_DIR/mobile-packages/"
        
        # Instructions de build
        cat > "../$DISTRIBUTION_DIR/mobile-packages/BUILD_INSTRUCTIONS.md" << 'MOBILE_EOF'
# 📱 Smart GMAO DiagFix Mobile - Instructions de Build

## Prérequis
- React Native CLI
- Android Studio (pour Android)
- Xcode (pour iOS)

## Build Android
```bash
cd android
./gradlew assembleRelease
```

## Build iOS
```bash
cd ios
xcodebuild -workspace SmartGMAO.xcworkspace -scheme SmartGMAO archive
```

## Configuration
Modifiez `src/config/api.ts` avec l'URL de votre serveur :
```typescript
export const API_BASE_URL = 'https://votre-domaine.com/api';
```
MOBILE_EOF
        
        print_success "Package mobile préparé"
    fi
    
    cd ..
fi

# Génération du rapport de distribution
print_step "Génération du rapport de distribution..."
cat > "$DISTRIBUTION_DIR/DISTRIBUTION_REPORT.md" << EOF
# 📋 Rapport de Distribution - Smart GMAO DiagFix

## Informations Générales
- **Version**: $VERSION
- **Date de Build**: $BUILD_DATE
- **Taille**: $ARCHIVE_SIZE
- **Type**: Distribution Entreprise

## Contenu du Package
- ✅ Application Web (Frontend + Backend)
- ✅ Scripts d'installation automatisés
- ✅ Configuration Docker Compose
- ✅ Service systemd
- ✅ Application mobile React Native
- ✅ Documentation complète
- ✅ Guide de démarrage rapide

## Installation Rapide
\`\`\`bash
# Installation automatique
curl -sSL https://install.smart-gmao-diagfix.com | sudo bash

# Ou manuel
sudo ./scripts/install.sh
\`\`\`

## Support
- 📖 Documentation: DOCUMENTATION_COMPLETE_SMART_GMAO_DIAGFIX.md
- 🚀 Guide rapide: GUIDE_DEMARRAGE_RAPIDE.md
- 🔧 Installation: INSTALLATION_LOCALE.md

## Validation
- Checksums disponibles dans: checksums.txt
- Tests d'installation: ./scripts/test-installation.sh

---
**Smart GMAO DiagFix** - Plateforme de Maintenance Industrielle Intelligente
EOF

print_success "Rapport de distribution généré"

# Résumé final
echo -e "\n${GREEN}=================================================================="
echo "  ✅ DISTRIBUTION SMART GMAO DIAGFIX CRÉÉE AVEC SUCCÈS"
echo "=================================================================="
echo -e "${NC}"

print_info "📦 Archive de distribution: $ARCHIVE_NAME"
print_info "📁 Répertoire: $DISTRIBUTION_DIR"
print_info "📏 Taille: $ARCHIVE_SIZE"
print_info "🔧 Script d'installation: install-smart-gmao-diagfix.sh"

echo -e "\n${YELLOW}📋 Prochaines étapes:${NC}"
echo "1. Tester l'installation: tar -xzf $ARCHIVE_NAME && cd $DISTRIBUTION_DIR && sudo ./scripts/install.sh"
echo "2. Publier sur serveur de distribution"
echo "3. Mettre à jour les liens de téléchargement"
echo "4. Tester l'installation automatique"

echo -e "\n${CYAN}🌐 URL d'installation automatique:${NC}"
echo "curl -sSL https://install.smart-gmao-diagfix.com | sudo bash"

print_success "Setup de distribution terminé!"