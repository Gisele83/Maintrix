#!/bin/bash

# Script de gestion de l'environnement de test Smart GMAO DiagFix
# Usage: ./scripts/test-environment.sh [setup|start|clean|help]

set -e

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Smart GMAO DiagFix - Gestion Environnement de Test${NC}"
echo

# Fonction d'aide
show_help() {
    echo "Usage: $0 [commande]"
    echo
    echo "Commandes disponibles:"
    echo "  setup   - Configure l'environnement de test (base de données + données)"
    echo "  start   - Démarre l'application en mode test"
    echo "  clean   - Nettoie les données de test"
    echo "  help    - Affiche cette aide"
    echo
    echo "Exemples:"
    echo "  $0 setup   # Configuration complète de l'environnement de test"
    echo "  $0 start   # Démarrage en mode test"
    echo "  $0 clean   # Nettoyage des données"
}

# Configuration de l'environnement de test
setup_test_environment() {
    echo -e "${YELLOW}📋 Configuration de l'environnement de test...${NC}"
    echo
    
    # Vérifier que NODE_ENV est défini
    export NODE_ENV=test
    
    # Exécuter le script de setup
    echo -e "${BLUE}🔧 Exécution du script de configuration...${NC}"
    tsx scripts/setup-test-environment.ts
    
    echo
    echo -e "${GREEN}✅ Environnement de test configuré avec succès !${NC}"
    echo
    echo -e "${YELLOW}📋 Comptes de test créés :${NC}"
    echo "   📧 Email: admin@test.smartgmao.com (Administrateur)"
    echo "   📧 Email: technicien@test.smartgmao.com (Technicien)"
    echo "   📧 Email: responsable@test.smartgmao.com (Superviseur)"
    echo "   🔑 Mot de passe: Test123!"
    echo
    echo -e "${BLUE}▶️  Pour démarrer: $0 start${NC}"
}

# Démarrage en mode test
start_test_environment() {
    echo -e "${YELLOW}🚀 Démarrage de l'application en mode test...${NC}"
    echo
    
    export NODE_ENV=test
    
    echo -e "${BLUE}🌐 L'application sera accessible sur http://localhost:5000${NC}"
    echo -e "${BLUE}🔒 Utilisez les comptes de test pour vous connecter${NC}"
    echo
    
    # Démarrer l'application
    tsx server/index.ts
}

# Nettoyage des données de test
clean_test_data() {
    echo -e "${YELLOW}🧹 Nettoyage des données de test...${NC}"
    echo
    
    export NODE_ENV=test
    
    # Exécuter le générateur avec nettoyage uniquement
    tsx -e "
    import { TestDataGenerator } from './server/test-data/test-data-generator.js';
    TestDataGenerator.generateTestData({ 
      clearExisting: true, 
      equipmentCount: 0, 
      workOrderCount: 0, 
      userCount: 0, 
      sparePartsCount: 0 
    }).then(() => console.log('✅ Données nettoyées'))
    .catch(console.error);
    "
    
    echo
    echo -e "${GREEN}✅ Données de test nettoyées !${NC}"
}

# Point d'entrée principal
case "${1:-help}" in
    setup)
        setup_test_environment
        ;;
    start)
        start_test_environment
        ;;
    clean)
        clean_test_data
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}❌ Commande inconnue: $1${NC}"
        echo
        show_help
        exit 1
        ;;
esac