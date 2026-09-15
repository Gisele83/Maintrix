#!/usr/bin/env bash
#
# Déploiement SÉCURISÉ de Maintrix sur l'instance OVHcloud.
#
#   sudo bash scripts/deploy-ovh.sh <domaine> <courriel>
#
# Utilisé À L'IDENTIQUE à la main et par la CI (.github/workflows/deploy-ovh.yml) :
# la CI n'a aucun chemin plus court que l'exploitant.
#
# ═══════════════════════════════════════════════════════════════════
# RÈGLES — les données des testeurs doivent survivre jusqu'en production
# ═══════════════════════════════════════════════════════════════════
#   • AUCUNE suppression de volume. Les volumes portent des noms permanents et
#     sont déclarés `external` dans docker-compose.test.yml : docker compose ne
#     peut ni les créer ni les supprimer, pas même avec `down -v`. L'inventaire
#     des volumes est comparé avant et après chaque déploiement.
#   • Sauvegarde CHIFFRÉE avant toute mise à jour d'une base existante.
#   • Restauration de cette sauvegarde dans une base ISOLÉE, et application du
#     nouveau schéma sur cette copie, AVANT de toucher à la base réelle.
#   • Interruption automatique à la première vérification en échec ; si la
#     nouvelle version a déjà démarré, retour à l'image applicative précédente.
#   • Aucun code non commité ne se déploie.
#
# ═══════════════════════════════════════════════════════════════════
# ÉTAPES
# ═══════════════════════════════════════════════════════════════════
#   1. prérequis                 5. mise à jour (schéma, sonde, application)
#   2. certificat TLS            6. renouvellement du certificat
#   3. sauvegarde chiffrée       7. porte d'ouverture
#   4. restauration vérifiée
set -euo pipefail

DOMAINE="${1:-}"
COURRIEL="${2:-}"

rouge()  { printf '\033[31m%s\033[0m\n' "$*"; }
vert()   { printf '\033[32m%s\033[0m\n' "$*"; }
jaune()  { printf '\033[33m%s\033[0m\n' "$*"; }
titre()  { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
mourir() { rouge "⛔ $*"; rouge "DÉPLOIEMENT INTERROMPU — rien n'a été modifié."; exit 1; }

if [ -z "$DOMAINE" ] || [ -z "$COURRIEL" ]; then
  cat <<'AIDE'
Usage :
  sudo bash scripts/deploy-ovh.sh <domaine> <courriel>

  <domaine>   nom complet servant aux testeurs, ex. maintrix-test.techlearn-saem.com
              Il doit DÉJÀ pointer (enregistrement A) vers l'IP de cette machine.
  <courriel>  adresse de contact Let's Encrypt (avis d'expiration du certificat)
AIDE
  exit 2
fi

cd "$(dirname "$0")/.."
RACINE="$(pwd)"
COMPOSE=(docker compose --env-file .env.test-cloud -f docker-compose.test.yml -p maintrix-test)
IMAGE_APP="maintrix-test-app"
DB="maintrix-test-db"
DOSSIER_SAUVEGARDES="${MAINTRIX_DOSSIER_SAUVEGARDES:-/var/backups/maintrix}"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo inconnu)"

inventaire_volumes() { docker volume ls -q | grep -E '^maintrix-test_' | sort || true; }

IMAGE_PRECEDENTE=""
VOLUMES_AVANT=""

controler_volumes() {
  local disparus
  disparus="$(comm -23 <(printf '%s\n' "$VOLUMES_AVANT" | grep . || true) <(inventaire_volumes))"
  if [ -n "$disparus" ]; then
    rouge "⛔ VOLUME(S) DISPARU(S) PENDANT LE DÉPLOIEMENT :"
    printf '     %s\n' $disparus
    return 1
  fi
}

# Après le début de la mise à jour, un échec ramène l'image précédente. Le
# schéma éventuellement appliqué reste en place : la restauration vérifiée a
# prouvé, sur une copie, qu'il ne supprime aucune colonne ni aucune ligne.
echec() {
  rouge "⛔ $*"
  if [ -n "$IMAGE_PRECEDENTE" ]; then
    jaune "  retour à l'image applicative précédente : $IMAGE_PRECEDENTE"
    docker tag "$IMAGE_PRECEDENTE" "$IMAGE_APP:latest" || true
    "${COMPOSE[@]}" up -d --no-build app || true
  fi
  controler_volumes || true
  rouge "DÉPLOIEMENT INTERROMPU — commit $COMMIT non déployé."
  [ -n "${SAUVEGARDE:-}" ] && jaune "  Sauvegarde chiffrée d'avant déploiement : $SAUVEGARDE"
  exit 1
}

# ═══════════════════════════════════════════════════════════════════
titre "1/7 — Prérequis"

[ "$(id -u)" -eq 0 ] || mourir "à lancer avec sudo (certbot, sauvegardes et ports 80/443 l'exigent)"

command -v docker >/dev/null 2>&1 || mourir "Docker absent. Voir docs/DEPLOY_OVH.md, étape 2."
docker compose version >/dev/null 2>&1 || mourir "Le plugin 'docker compose' (v2) est absent."
docker info >/dev/null 2>&1 || mourir "Le démon Docker ne répond pas."
command -v node >/dev/null 2>&1 || mourir "Node.js absent. Voir docs/DEPLOY_OVH.md, étape 2."
command -v gpg >/dev/null 2>&1 || mourir "GnuPG absent (sauvegardes chiffrées) : apt install -y gnupg"
vert "  ✓ Docker $(docker version -f '{{.Server.Version}}'), Node $(node --version), GnuPG"

# Aucun code non commité : le premier déploiement était une copie de fichiers
# sans lien avec Git, et un `git pull` l'aurait écrasé.
if [ -n "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]; then
  git status --short --untracked-files=no
  mourir "modifications locales non commitées sur le serveur — seul un commit peut être déployé"
fi
vert "  ✓ code du commit $COMMIT, sans modification locale"

# ── Le DNS pointe-t-il vers CETTE machine ? ─────────────────────────
IP_PUBLIQUE="$(curl -fsS --max-time 15 https://api.ipify.org || echo '')"
# `getent hosts` renvoie l'IPv6 en premier quand le domaine a un AAAA : on
# collecte TOUTES les adresses IPv4 et on cherche la nôtre parmi elles.
IPS_V4="$(getent ahostsv4 "$DOMAINE" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ' || echo '')"
IPS_V4="$(echo "$IPS_V4" | xargs || echo '')"

[ -n "$IP_PUBLIQUE" ] || jaune "  ⚠ IP publique de la machine indéterminable (pas de sortie Internet ?)"
if [ -z "$IPS_V4" ]; then
  mourir "$DOMAINE ne résout vers aucune adresse IPv4."
elif [ -n "$IP_PUBLIQUE" ] && ! echo " $IPS_V4 " | grep -q " $IP_PUBLIQUE "; then
  mourir "$DOMAINE pointe vers $IPS_V4, mais cette machine est en $IP_PUBLIQUE (proxy Cloudflare actif ?)."
fi
vert "  ✓ $DOMAINE → $IPS_V4 (cette machine)"

for port in 80 443; do
  if ss -ltn "( sport = :$port )" 2>/dev/null | grep -q LISTEN \
     && ! docker ps --format '{{.Names}}\t{{.Ports}}' | grep -q "maintrix-test-nginx.*:$port->"; then
    mourir "Le port $port est occupé par un autre service : ss -ltnp '( sport = :$port )'"
  fi
done
vert "  ✓ ports 80/443 disponibles"

VOLUMES_AVANT="$(inventaire_volumes)"
echo "  volumes présents : $(printf '%s\n' "$VOLUMES_AVANT" | grep -c . || true)"

echo "  installation des dépendances (versions verrouillées)…"
npm ci --no-audit --no-fund --loglevel=error || mourir "npm ci a échoué"

# ═══════════════════════════════════════════════════════════════════
titre "2/7 — Certificat TLS"

CERT_LE="/etc/letsencrypt/live/$DOMAINE/fullchain.pem"
CLE_LE="/etc/letsencrypt/live/$DOMAINE/privkey.pem"
mkdir -p "$RACINE/ssl" "$RACINE/certbot-webroot/.well-known/acme-challenge"

if [ ! -f "$CERT_LE" ] || ! openssl x509 -in "$CERT_LE" -noout -checkend $((30 * 86400)) >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' | grep -qx maintrix-test-nginx; then
    docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -v "$RACINE/certbot-webroot:/var/www/certbot" \
      certbot/certbot certonly --webroot -w /var/www/certbot -d "$DOMAINE" --email "$COURRIEL" \
      --agree-tos --no-eff-email --non-interactive \
      || mourir "Émission du certificat échouée (http://$DOMAINE/.well-known/acme-challenge/ joignable ?)"
  else
    docker run --rm -p 80:80 -v /etc/letsencrypt:/etc/letsencrypt \
      certbot/certbot certonly --standalone -d "$DOMAINE" --email "$COURRIEL" \
      --agree-tos --no-eff-email --non-interactive \
      || mourir "Émission du certificat échouée (port 80 joignable depuis Internet ?)"
  fi
  vert "  ✓ certificat obtenu"
else
  vert "  ✓ certificat encore valide plus de 30 jours — non redemandé"
fi
install -m 644 "$CERT_LE" "$RACINE/ssl/maintrix.crt"
install -m 600 "$CLE_LE"  "$RACINE/ssl/maintrix.key"

# ═══════════════════════════════════════════════════════════════════
titre "3/7 — Sauvegarde chiffrée"

BASE_EXISTANTE=non
SAUVEGARDE=""
if docker inspect "$DB" >/dev/null 2>&1; then
  BASE_EXISTANTE=oui
  docker start "$DB" >/dev/null 2>&1 || true
  for _ in $(seq 1 30); do
    [ "$(docker inspect -f '{{.State.Health.Status}}' "$DB" 2>/dev/null || true)" = "healthy" ] && break
    sleep 2
  done
  bash scripts/sauvegarde-chiffree.sh || mourir "sauvegarde chiffrée impossible"
  SAUVEGARDE="$(cat "$DOSSIER_SAUVEGARDES/derniere")"
else
  jaune "  aucune base existante — première installation, rien à sauvegarder"
fi

# ═══════════════════════════════════════════════════════════════════
titre "4/7 — Restauration vérifiée dans une base isolée"

if [ "$BASE_EXISTANTE" = oui ]; then
  bash scripts/restauration-verifiee.sh "$SAUVEGARDE" || mourir "restauration non vérifiée"
  export MAINTRIX_SCHEMA_VERIFIE="$SAUVEGARDE/restauration-verifiee.ok"
else
  jaune "  première installation — rien à restaurer"
fi

# ═══════════════════════════════════════════════════════════════════
titre "5/7 — Mise à jour"

# Repli possible : l'image en service est conservée sous un nom daté.
if docker image inspect "$IMAGE_APP:latest" >/dev/null 2>&1; then
  IMAGE_PRECEDENTE="$IMAGE_APP:avant-$(date -u +%Y%m%dT%H%M%SZ)"
  docker tag "$IMAGE_APP:latest" "$IMAGE_PRECEDENTE"
  echo "  image en service conservée : $IMAGE_PRECEDENTE"
fi

node scripts/provision-test-env.mjs --public-url="https://$DOMAINE" \
  || echec "mise à jour ou conformité en échec — voir ci-dessus"

"${COMPOSE[@]}" up -d --no-build app nginx || echec "redémarrage applicatif en échec"
controler_volumes || echec "un volume a disparu pendant la mise à jour"
vert "  ✓ application et nginx en service sur le commit $COMMIT"

# ═══════════════════════════════════════════════════════════════════
titre "6/7 — Renouvellement automatique du certificat"

cat > /etc/cron.weekly/maintrix-renouveler-cert <<CRON
#!/bin/sh
# Renouvellement du certificat de $DOMAINE — installé par scripts/deploy-ovh.sh
cd "$RACINE" || exit 0
docker run --rm \\
  -v /etc/letsencrypt:/etc/letsencrypt \\
  -v "$RACINE/certbot-webroot:/var/www/certbot" \\
  certbot/certbot renew --webroot -w /var/www/certbot --quiet || exit 1
install -m 644 "$CERT_LE" "$RACINE/ssl/maintrix.crt"
install -m 600 "$CLE_LE"  "$RACINE/ssl/maintrix.key"
docker exec maintrix-test-nginx nginx -s reload 2>/dev/null || true
CRON
chmod +x /etc/cron.weekly/maintrix-renouveler-cert
vert "  ✓ /etc/cron.weekly/maintrix-renouveler-cert installé"

# ═══════════════════════════════════════════════════════════════════
titre "7/7 — Porte d'ouverture"

sleep 10
node scripts/verify-opening.mjs || echec "porte d'ouverture refusée"
controler_volumes || echec "un volume a disparu"

# Seules les deux dernières images de repli sont gardées : chacune pèse
# plusieurs Go. Ce sont des IMAGES, jamais des volumes.
docker images --format '{{.Repository}}:{{.Tag}}' | grep "^$IMAGE_APP:avant-" | sort | head -n -2 \
  | xargs -r docker rmi >/dev/null 2>&1 || true

echo
vert "═══════════════════════════════════════════════════════════"
vert "  DÉPLOIEMENT RÉUSSI — commit $COMMIT"
vert "═══════════════════════════════════════════════════════════"
echo
echo "  Adresse testeurs     https://$DOMAINE/"
[ -n "$SAUVEGARDE" ] && echo "  Sauvegarde préalable $SAUVEGARDE"
echo "  Volumes              $(inventaire_volumes | tr '\n' ' ')"
echo "  Fermer l'accès       docker stop maintrix-test-nginx"
echo
