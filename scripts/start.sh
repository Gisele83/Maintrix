#!/bin/bash

# 🚀 Script de Démarrage - Maintrix
# Script pour démarrage manuel ou debug

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Détection du répertoire du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

print_status "Répertoire application: $APP_DIR"

# Vérification des fichiers nécessaires
if [[ ! -f "$APP_DIR/.env" ]]; then
    print_error "Fichier .env manquant. Copiez .env.example vers .env et configurez-le."
    exit 1
fi

if [[ ! -f "$APP_DIR/package.json" ]]; then
    print_error "Fichier package.json manquant. Êtes-vous dans le bon répertoire ?"
    exit 1
fi

# Chargement des variables d'environnement
print_status "Chargement de la configuration..."
export $(grep -v '^#' "$APP_DIR/.env" | xargs)

# Vérification de Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js n'est pas installé"
    exit 1
fi

node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [[ $node_version -lt 18 ]]; then
    print_error "Node.js version 18+ requise. Version actuelle: $(node --version)"
    exit 1
fi

print_success "Node.js $(node --version) détecté"

# Vérification de la base de données
print_status "Vérification de la base de données..."
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1;" &>/dev/null; then
        print_success "Connexion base de données OK"
    else
        print_error "Impossible de se connecter à la base de données"
        print_status "Vérifiez la variable DATABASE_URL dans .env"
        exit 1
    fi
else
    print_error "PostgreSQL client (psql) non installé"
    exit 1
fi

# Navigation vers le répertoire de l'application
cd "$APP_DIR"

# Vérification et installation des dépendances si nécessaire
if [[ ! -d "node_modules" ]]; then
    print_status "Installation des dépendances..."
    npm install
fi

# Construction de l'application si nécessaire
if [[ ! -d "dist" ]] || [[ "package.json" -nt "dist" ]]; then
    print_status "Construction de l'application..."
    npm run build
fi

# Migration de la base de données si nécessaire
print_status "Application des migrations..."
npm run db:push

# Création des répertoires nécessaires
mkdir -p uploads logs backups
mkdir -p uploads/public uploads/private

# Configuration des permissions si nous sommes root
if [[ $EUID -eq 0 ]] && [[ -n "$SUDO_USER" ]]; then
    print_status "Configuration des permissions..."
    chown -R $SUDO_USER:$SUDO_USER uploads logs backups
fi

# Démarrage de l'application
print_status "Démarrage de Maintrix..."
print_status "Port: ${PORT:-5000}"
print_status "Environnement: ${NODE_ENV:-development}"

echo -e "${GREEN}"
echo "========================================"
echo "  Maintrix - Démarrage"
echo "========================================"
echo -e "${NC}"

# Démarrage avec gestion des signaux
trap 'echo -e "\n${YELLOW}Arrêt en cours...${NC}"; exit 0' INT TERM

if [[ "${NODE_ENV:-development}" == "development" ]]; then
    npm run dev
else
    npm start
fi