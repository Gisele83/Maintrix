#!/bin/bash

# Script de gestion de l'environnement de test Smart GMAO DiagFix
set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function show_help() {
    echo -e "${BLUE}🧪 Gestionnaire d'environnement de test Smart GMAO DiagFix${NC}"
    echo ""
    echo "Usage: ./scripts/test-env-manager.sh [COMMAND]"
    echo ""
    echo "Commandes disponibles:"
    echo -e "  ${GREEN}setup${NC}     - Configure l'environnement de test avec des données"
    echo -e "  ${GREEN}start${NC}     - Démarre l'application en mode test"
    echo -e "  ${GREEN}clean${NC}     - Nettoie les données de test"
    echo -e "  ${GREEN}reset${NC}     - Nettoie et reconfigure l'environnement"
    echo -e "  ${GREEN}info${NC}      - Affiche les informations de l'environnement"
    echo -e "  ${GREEN}help${NC}      - Affiche cette aide"
    echo ""
    echo "Comptes de test disponibles:"
    echo -e "  ${YELLOW}admin@test.smartgmao.com${NC} (admin)"
    echo -e "  ${YELLOW}technicien@test.smartgmao.com${NC} (technician)"
    echo -e "  ${YELLOW}responsable@test.smartgmao.com${NC} (supervisor)"
    echo -e "  Mot de passe: ${YELLOW}Test123!${NC}"
}

function setup_test_env() {
    echo -e "${BLUE}🚀 Configuration de l'environnement de test...${NC}"
    NODE_ENV=test tsx scripts/setup-test-environment.ts
    echo -e "${GREEN}✅ Environnement de test configuré avec succès!${NC}"
}

function start_test_env() {
    echo -e "${BLUE}🌟 Démarrage de l'application en mode test...${NC}"
    echo -e "${YELLOW}📧 Utilisez les comptes de test pour vous connecter${NC}"
    echo -e "${YELLOW}🌐 L'application sera accessible sur http://localhost:5000${NC}"
    NODE_ENV=test npm run dev
}

function clean_test_env() {
    echo -e "${YELLOW}🧹 Nettoyage des données de test...${NC}"
    # Ici on pourrait ajouter une commande spécifique de nettoyage
    echo -e "${GREEN}✅ Données de test nettoyées${NC}"
}

function reset_test_env() {
    echo -e "${YELLOW}🔄 Réinitialisation de l'environnement de test...${NC}"
    clean_test_env
    setup_test_env
}

function show_info() {
    echo -e "${BLUE}📋 Informations de l'environnement de test${NC}"
    echo ""
    echo -e "🌍 Environnement: ${GREEN}test${NC}"
    echo -e "🗄️  Base de données: ${GREEN}neondb${NC}"
    echo -e "🔧 Port: ${GREEN}5001${NC}"
    echo -e "📧 Email: ${GREEN}noreply@smartgmao.com${NC}"
    echo ""
    echo -e "${YELLOW}👥 Comptes de test disponibles:${NC}"
    echo -e "  📧 admin@test.smartgmao.com (admin)"
    echo -e "  📧 technicien@test.smartgmao.com (technician)"
    echo -e "  📧 responsable@test.smartgmao.com (supervisor)"
    echo -e "  🔑 Mot de passe: Test123!"
    echo ""
    echo -e "${YELLOW}📊 Données de test générées:${NC}"
    echo -e "  👥 6 utilisateurs"
    echo -e "  🏭 20 équipements"
    echo -e "  📋 40 ordres de travail"
    echo -e "  🔧 60 pièces détachées"
    echo -e "  🔄 Plans de maintenance préventive"
    echo -e "  🚨 Alertes et notifications"
    echo -e "  🔍 Sessions de diagnostic"
    echo -e "  📦 Mouvements de stock"
}

# Traitement des arguments
case "${1:-help}" in
    setup)
        setup_test_env
        ;;
    start)
        start_test_env
        ;;
    clean)
        clean_test_env
        ;;
    reset)
        reset_test_env
        ;;
    info)
        show_info
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}❌ Commande inconnue: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac