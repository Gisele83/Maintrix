#!/bin/bash

# 🧪 Script de Test - Smart GMAO DiagFix
# Test complet de l'installation et du fonctionnement

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# Compteurs de tests
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Fonction de test générique
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    print_test "$test_name"
    
    if eval "$test_command" >/dev/null 2>&1; then
        print_pass "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_fail "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="smart-gmao-diagfix"

echo -e "${BLUE}"
echo "========================================"
echo "  Smart GMAO DiagFix - Tests Installation"
echo "========================================"
echo -e "${NC}"

print_info "Répertoire de test: $APP_DIR"

# Chargement de la configuration si disponible
if [[ -f "$APP_DIR/.env" ]]; then
    export $(grep -v '^#' "$APP_DIR/.env" | xargs)
    print_info "Configuration chargée depuis .env"
else
    print_info "Fichier .env non trouvé, utilisation des valeurs par défaut"
    export PORT=5000
    export NODE_ENV=development
fi

echo ""
echo -e "${BLUE}=== TESTS PRÉREQUIS SYSTÈME ===${NC}"

# Tests des prérequis système
run_test "Node.js installé" "command -v node"
run_test "npm installé" "command -v npm"
run_test "PostgreSQL installé" "command -v psql"
run_test "Git installé" "command -v git"
run_test "curl installé" "command -v curl"

# Vérification des versions
if command -v node >/dev/null; then
    node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    run_test "Node.js version >= 18" "[[ $node_version -ge 18 ]]"
    print_info "Version Node.js: $(node --version)"
fi

echo ""
echo -e "${BLUE}=== TESTS STRUCTURE APPLICATION ===${NC}"

# Tests de la structure de l'application
run_test "Répertoire application existe" "[[ -d '$APP_DIR' ]]"
run_test "package.json existe" "[[ -f '$APP_DIR/package.json' ]]"
run_test "Répertoire scripts existe" "[[ -d '$APP_DIR/scripts' ]]"
run_test "Script d'installation existe" "[[ -f '$APP_DIR/scripts/install.sh' ]]"
run_test "Script de démarrage existe" "[[ -f '$APP_DIR/scripts/start.sh' ]]"
run_test "Script de sauvegarde existe" "[[ -f '$APP_DIR/scripts/backup.sh' ]]"
run_test "Script de mise à jour existe" "[[ -f '$APP_DIR/scripts/update.sh' ]]"

# Tests des permissions des scripts
run_test "Script install.sh exécutable" "[[ -x '$APP_DIR/scripts/install.sh' ]]"
run_test "Script start.sh exécutable" "[[ -x '$APP_DIR/scripts/start.sh' ]]"
run_test "Script backup.sh exécutable" "[[ -x '$APP_DIR/scripts/backup.sh' ]]"
run_test "Script update.sh exécutable" "[[ -x '$APP_DIR/scripts/update.sh' ]]"

echo ""
echo -e "${BLUE}=== TESTS DÉPENDANCES ===${NC}"

cd "$APP_DIR"

# Tests des dépendances
run_test "node_modules existe" "[[ -d 'node_modules' ]]"
if [[ -d "node_modules" ]]; then
    run_test "Dépendances installées" "npm list --depth=0"
fi

echo ""
echo -e "${BLUE}=== TESTS CONFIGURATION ===${NC}"

# Tests de configuration
run_test "Fichier .env existe" "[[ -f '$APP_DIR/.env' ]]"
run_test "Dockerfile existe" "[[ -f '$APP_DIR/Dockerfile' ]]"
run_test "docker-compose.yml existe" "[[ -f '$APP_DIR/docker-compose.yml' ]]"

if [[ -f ".env" ]]; then
    run_test "DATABASE_URL définie" "[[ -n '$DATABASE_URL' ]]"
    run_test "PORT défini" "[[ -n '$PORT' ]]"
    run_test "NODE_ENV défini" "[[ -n '$NODE_ENV' ]]"
fi

echo ""
echo -e "${BLUE}=== TESTS BASE DE DONNÉES ===${NC}"

# Tests de la base de données
if [[ -n "$DATABASE_URL" ]]; then
    run_test "Connexion à la base de données" "psql '$DATABASE_URL' -c 'SELECT 1;'"
    run_test "Tables application créées" "psql '$DATABASE_URL' -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';\""
else
    print_info "DATABASE_URL non définie, tests de base ignorés"
fi

echo ""
echo -e "${BLUE}=== TESTS SERVICE SYSTÈME ===${NC}"

# Tests du service systemd (si root)
if [[ $EUID -eq 0 ]]; then
    run_test "Fichier service systemd existe" "[[ -f '/etc/systemd/system/$SERVICE_NAME.service' ]]"
    run_test "Service activé" "systemctl is-enabled $SERVICE_NAME"
    run_test "Service en fonctionnement" "systemctl is-active $SERVICE_NAME"
else
    print_info "Tests service systemd ignorés (privilèges root requis)"
fi

echo ""
echo -e "${BLUE}=== TESTS APPLICATION ===${NC}"

# Test de construction de l'application
run_test "Construction de l'application" "npm run build"
run_test "Répertoire dist créé" "[[ -d 'dist' ]]"

# Tests de l'API (si l'application tourne)
API_URL="http://localhost:${PORT:-5000}"
if curl -f -s "$API_URL/api/health" >/dev/null 2>&1; then
    run_test "API accessible" "curl -f -s '$API_URL/api/health'"
    run_test "Endpoint diagnostics accessible" "curl -f -s '$API_URL/api/diagnostic/equipment-identifiers'"
    run_test "Endpoint alertes accessible" "curl -f -s '$API_URL/api/alerts'"
    
    # Test des pages principales
    run_test "Page d'accueil accessible" "curl -f -s '$API_URL/'"
    run_test "Page diagnostic accessible" "curl -f -s '$API_URL/smart-diagnostic'"
    run_test "Page GMAO accessible" "curl -f -s '$API_URL/gmao-dashboard'"
else
    print_info "Application non accessible, tests d'API ignorés"
    print_info "Pour tester l'API, démarrez l'application avec: npm start"
fi

echo ""
echo -e "${BLUE}=== TESTS FONCTIONNALITÉS ===${NC}"

# Tests des fonctionnalités métier (si l'application tourne)
if curl -f -s "$API_URL/api/health" >/dev/null 2>&1; then
    # Test d'un diagnostic simple
    run_test "Test diagnostic simple" "curl -f -s -X POST '$API_URL/api/diagnostic/analyze' -H 'Content-Type: application/json' -d '{\"equipmentId\":\"EQ001\",\"symptoms\":\"Vibration excessive\"}'"
    
    # Test de la liste des équipements
    run_test "Liste équipements accessible" "curl -f -s '$API_URL/api/gmao/equipment'"
    
    # Test des alertes
    run_test "Système d'alertes fonctionnel" "curl -f -s '$API_URL/api/alerts' | grep -q 'alertType'"
fi

echo ""
echo -e "${BLUE}=== TESTS SÉCURITÉ ===${NC}"

# Tests de sécurité de base
run_test "Permissions .env sécurisées" "[[ \$(stat -c %a '$APP_DIR/.env' 2>/dev/null || echo '644') = '600' ]]"
run_test "Répertoire uploads protégé" "[[ -d '$APP_DIR/uploads' && \$(stat -c %a '$APP_DIR/uploads' 2>/dev/null || echo '755') = '755' ]]"

# Test d'injection SQL basique (si API accessible)
if curl -f -s "$API_URL/api/health" >/dev/null 2>&1; then
    run_test "Protection injection SQL basique" "! curl -f -s '$API_URL/api/diagnostic/equipment-identifiers?id=1%27%20OR%20%271%27=%271' | grep -q 'error'"
fi

echo ""
echo -e "${BLUE}=== TESTS PERFORMANCE ===${NC}"

# Tests de performance basiques
if curl -f -s "$API_URL/api/health" >/dev/null 2>&1; then
    # Temps de réponse API
    response_time=$(curl -o /dev/null -s -w '%{time_total}' "$API_URL/api/health")
    run_test "API répond en < 5 secondes" "[[ \$(echo \"$response_time < 5.0\" | bc -l) -eq 1 ]]"
    print_info "Temps de réponse API: ${response_time}s"
fi

# Utilisation mémoire du processus Node.js
if pgrep -f "npm.*start\|node.*server" >/dev/null; then
    memory_usage=$(ps -o pid,rss -p $(pgrep -f "npm.*start\|node.*server" | head -1) | tail -1 | awk '{print $2}')
    memory_mb=$((memory_usage / 1024))
    run_test "Utilisation mémoire < 1GB" "[[ $memory_mb -lt 1024 ]]"
    print_info "Utilisation mémoire: ${memory_mb}MB"
fi

echo ""
echo -e "${BLUE}=== RÉSULTATS FINAUX ===${NC}"

print_info "Tests exécutés: $TESTS_TOTAL"
print_pass "Tests réussis: $TESTS_PASSED"
if [[ $TESTS_FAILED -gt 0 ]]; then
    print_fail "Tests échoués: $TESTS_FAILED"
else
    print_pass "Tests échoués: $TESTS_FAILED"
fi

# Calcul du pourcentage de réussite
success_rate=$((TESTS_PASSED * 100 / TESTS_TOTAL))
print_info "Taux de réussite: ${success_rate}%"

echo ""
if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}🎉 TOUS LES TESTS SONT PASSÉS ! Installation parfaite.${NC}"
    exit 0
elif [[ $success_rate -ge 80 ]]; then
    echo -e "${YELLOW}⚠️  Installation fonctionnelle avec quelques problèmes mineurs.${NC}"
    echo -e "${YELLOW}Consultez les tests échoués ci-dessus pour les corrections.${NC}"
    exit 1
else
    echo -e "${RED}❌ Installation problématique. Plusieurs tests ont échoué.${NC}"
    echo -e "${RED}Vérifiez l'installation et relancez le script de test.${NC}"
    exit 2
fi