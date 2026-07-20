#!/bin/bash
set -e

echo "=========================================="
echo "  Maintrix - Configuration AWS SSM Parameters"
echo "=========================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

REGION=${AWS_REGION:-eu-west-3}

echo ""
print_info "Region: $REGION"
echo ""
echo "Ce script stocke les secrets Maintrix dans AWS SSM Parameter Store."
echo "Ces paramètres sont utilisés par ECS pour injecter les secrets au runtime."
echo ""

read -p "DATABASE_URL (postgresql://...): " DATABASE_URL
read -p "SESSION_SECRET (laisser vide pour auto-générer): " SESSION_SECRET
if [ -z "$SESSION_SECRET" ]; then
  SESSION_SECRET=$(openssl rand -hex 32)
  print_info "SESSION_SECRET généré automatiquement"
fi

read -p "ANTHROPIC_API_KEY: " ANTHROPIC_API_KEY
read -p "SENDGRID_API_KEY: " SENDGRID_API_KEY
read -p "STRIPE_SECRET_KEY (sk_live_... ou sk_test_...): " -s STRIPE_SECRET_KEY
echo ""
read -p "STRIPE_PUBLISHABLE_KEY (pk_live_... ou pk_test_...): " STRIPE_PUBLISHABLE_KEY
read -p "PAYPAL_CLIENT_ID: " PAYPAL_CLIENT_ID
read -p "PAYPAL_CLIENT_SECRET: " -s PAYPAL_CLIENT_SECRET
echo ""

echo ""
print_info "Enregistrement des paramètres dans SSM..."

declare -A PARAMS=(
  ["DATABASE_URL"]="$DATABASE_URL"
  ["SESSION_SECRET"]="$SESSION_SECRET"
  ["ANTHROPIC_API_KEY"]="$ANTHROPIC_API_KEY"
  ["SENDGRID_API_KEY"]="$SENDGRID_API_KEY"
  ["STRIPE_SECRET_KEY"]="$STRIPE_SECRET_KEY"
  ["STRIPE_PUBLISHABLE_KEY"]="$STRIPE_PUBLISHABLE_KEY"
  ["PAYPAL_CLIENT_ID"]="$PAYPAL_CLIENT_ID"
  ["PAYPAL_CLIENT_SECRET"]="$PAYPAL_CLIENT_SECRET"
)

for key in "${!PARAMS[@]}"; do
  if [ -n "${PARAMS[$key]}" ]; then
    aws ssm put-parameter \
      --name "/maintrix/$key" \
      --value "${PARAMS[$key]}" \
      --type SecureString \
      --overwrite \
      --region "$REGION" > /dev/null 2>&1
    print_success "$key enregistré"
  else
    print_warning "$key ignoré (vide)"
  fi
done

echo ""
print_success "Configuration SSM terminée!"
echo ""
echo "Vérification:"
aws ssm describe-parameters \
  --parameter-filters "Key=Name,Option=BeginsWith,Values=/maintrix/" \
  --region "$REGION" \
  --query 'Parameters[].Name' \
  --output table
