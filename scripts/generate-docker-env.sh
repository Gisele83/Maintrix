#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Génère .env.docker avec des secrets aléatoires forts.
# Le fichier produit est ignoré par git (.gitignore) : aucun secret
# généré ici ne peut entrer dans le dépôt.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

cd "$(dirname "$0")/.."
TARGET="${1:-.env.docker}"

if [ -e "$TARGET" ]; then
  echo "✗ $TARGET existe déjà — refus d'écraser des secrets en service."
  echo "  Pour une rotation : supprimez-le explicitement, puis relancez."
  exit 1
fi

if command -v openssl >/dev/null 2>&1; then
  gen() { openssl rand -hex "$1"; }
elif command -v node >/dev/null 2>&1; then
  gen() { node -e "console.log(require('crypto').randomBytes($1).toString('hex'))"; }
else
  echo "✗ openssl ou node requis pour générer les secrets."; exit 1
fi

umask 077   # fichier créé en 600 : lisible par le seul propriétaire

cat > "$TARGET" <<INNER
# Généré par scripts/generate-docker-env.sh le $(date -u +%Y-%m-%dT%H:%M:%SZ)
# NE JAMAIS COMMITTER — NE JAMAIS PARTAGER
# Environnement de TEST uniquement : ne pas réutiliser pour la production.

POSTGRES_DB=maintrix_db
POSTGRES_USER=maintrix_user
POSTGRES_PASSWORD=$(gen 24)

SESSION_SECRET=$(gen 64)
JWT_SECRET=$(gen 64)
KMS_MASTER_KEY=$(gen 32)
MFA_ENCRYPTION_KEY=$(gen 32)

REDIS_PASSWORD=$(gen 24)
GRAFANA_ADMIN_PASSWORD=$(gen 16)

# Services externes — à renseigner manuellement si nécessaire.
ANTHROPIC_API_KEY=
SENDGRID_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox
INNER

echo "✓ $TARGET généré (permissions 600, ignoré par git)."
echo "  Démarrage : docker compose --env-file $TARGET up -d"
