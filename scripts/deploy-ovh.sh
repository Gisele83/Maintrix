#!/usr/bin/env bash
#
# Déploiement de l'environnement de test sur une instance OVHcloud Public Cloud — F12.
#
#   sudo bash scripts/deploy-ovh.sh maintrix-test.techlearn-saem.com vous@exemple.fr
#
# ═══════════════════════════════════════════════════════════════════
# CE QUE FAIT CE SCRIPT
# ═══════════════════════════════════════════════════════════════════
#   1. vérifie les prérequis (Docker, ports libres, DNS résolvant vers CETTE machine)
#   2. obtient un certificat Let's Encrypt et le met en place
#   3. provisionne l'environnement avec le bon domaine public
#   4. installe le renouvellement automatique du certificat
#   5. passe la porte d'ouverture
#
# Il est IDEMPOTENT : relançable sans rien casser. Un certificat encore valide
# n'est pas redemandé — Let's Encrypt plafonne à 5 certificats par domaine et
# par semaine, et griller ce quota bloquerait le déploiement pendant 7 jours.
#
# ═══════════════════════════════════════════════════════════════════
# CE QU'IL NE FAIT PAS
# ═══════════════════════════════════════════════════════════════════
# Il ne crée pas l'instance et ne touche pas à votre zone DNS : ces deux étapes
# passent par l'espace client OVHcloud. Voir docs/DEPLOY_OVH.md.
set -euo pipefail

DOMAINE="${1:-}"
COURRIEL="${2:-}"

rouge()  { printf '\033[31m%s\033[0m\n' "$*"; }
vert()   { printf '\033[32m%s\033[0m\n' "$*"; }
jaune()  { printf '\033[33m%s\033[0m\n' "$*"; }
titre()  { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
mourir() { rouge "⛔ $*"; exit 1; }

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

# ═══════════════════════════════════════════════════════════════════
titre "1/5 — Prérequis"

[ "$(id -u)" -eq 0 ] || mourir "à lancer avec sudo (certbot et les ports 80/443 l'exigent)"

command -v docker >/dev/null 2>&1 || mourir "Docker absent. Voir docs/DEPLOY_OVH.md, étape 2."
docker compose version >/dev/null 2>&1 || mourir "Le plugin 'docker compose' (v2) est absent."
docker info >/dev/null 2>&1 || mourir "Le démon Docker ne répond pas."
vert "  ✓ Docker $(docker version -f '{{.Server.Version}}') opérationnel"

# ── Le DNS pointe-t-il vers CETTE machine ? ─────────────────────────
# Sans ce contrôle, certbot échoue avec un message obscur après avoir consommé
# une tentative. On préfère un diagnostic clair, avant.
IP_PUBLIQUE="$(curl -fsS --max-time 15 https://api.ipify.org || echo '')"

# ⚠️ `getent hosts` renvoie l'IPv6 EN PREMIER quand le domaine a un AAAA. La
# comparer à l'IPv4 rendue par api.ipify.org donne un faux négatif : un domaine
# parfaitement configuré en double pile serait rejeté. Constaté sur
# techlearn-saem.com, qui répond 2a06:98c1:3120::2 (Cloudflare).
# On collecte donc TOUTES les adresses IPv4, et on cherche la nôtre parmi elles.
IPS_V4="$(getent ahostsv4 "$DOMAINE" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ' || echo '')"
IPS_V4="$(echo "$IPS_V4" | xargs || echo '')"

[ -n "$IP_PUBLIQUE" ] || jaune "  ⚠ IP publique de la machine indéterminable (pas de sortie Internet ?)"

if [ -z "$IPS_V4" ]; then
  mourir "$DOMAINE ne résout vers aucune adresse IPv4.
   Créez un enregistrement A : $DOMAINE → ${IP_PUBLIQUE:-<IP de cette machine>}
   dans la zone DNS de techlearn-saem.com (espace client OVHcloud),
   puis attendez la propagation (quelques minutes à 24 h)."
elif [ -n "$IP_PUBLIQUE" ] && ! echo " $IPS_V4 " | grep -q " $IP_PUBLIQUE "; then
  mourir "$DOMAINE pointe vers : $IPS_V4
   … mais cette machine est en $IP_PUBLIQUE.

   Deux causes habituelles :
     • l'enregistrement A n'a pas encore été créé ou propagé ;
     • le domaine passe par un proxy (Cloudflare, etc.) qui masque l'origine.
       Pour ce sous-domaine, utilisez un enregistrement DNS SEUL, sans proxy —
       sinon Let's Encrypt valide le proxy et non cette machine."
else
  vert "  ✓ $DOMAINE → $IPS_V4 (cette machine)"
fi

# ── Les ports 80 et 443 sont-ils libres ? ──────────────────────────
for port in 80 443; do
  if ss -ltn "( sport = :$port )" 2>/dev/null | grep -q LISTEN; then
    # nginx de la stack Maintrix est acceptable : on l'arrêtera le temps voulu.
    if docker ps --format '{{.Names}}\t{{.Ports}}' | grep -q "maintrix-test-nginx.*:$port->"; then
      vert "  ✓ port $port occupé par maintrix-test-nginx (attendu)"
    else
      mourir "Le port $port est occupé par un autre service.
   Identifiez-le : ss -ltnp '( sport = :$port )'
   Un serveur web préinstallé (apache2, nginx système) doit être arrêté :
   systemctl disable --now apache2 nginx 2>/dev/null || true"
    fi
  else
    vert "  ✓ port $port libre"
  fi
done

# ═══════════════════════════════════════════════════════════════════
titre "2/5 — Certificat TLS"

CERT_LE="/etc/letsencrypt/live/$DOMAINE/fullchain.pem"
CLE_LE="/etc/letsencrypt/live/$DOMAINE/privkey.pem"
mkdir -p "$RACINE/ssl" "$RACINE/certbot-webroot/.well-known/acme-challenge"

besoin_certificat() {
  [ -f "$CERT_LE" ] || return 0
  # Renouveler en dessous de 30 jours restants ; sinon on ne touche à rien.
  openssl x509 -in "$CERT_LE" -noout -checkend $((30 * 86400)) >/dev/null 2>&1 && return 1 || return 0
}

if besoin_certificat; then
  if [ -f "$CERT_LE" ]; then
    jaune "  certificat existant proche de l'expiration — renouvellement"
  else
    echo "  aucun certificat pour $DOMAINE — première émission"
  fi

  # nginx tourne-t-il déjà ? Le mode « webroot » passe par lui ; sinon on prend
  # le mode « standalone », qui a besoin du port 80 pour lui seul.
  if docker ps --format '{{.Names}}' | grep -qx maintrix-test-nginx; then
    echo "  émission via nginx (webroot) — aucune coupure de service"
    docker run --rm \
      -v /etc/letsencrypt:/etc/letsencrypt \
      -v "$RACINE/certbot-webroot:/var/www/certbot" \
      certbot/certbot certonly --webroot -w /var/www/certbot \
      -d "$DOMAINE" --email "$COURRIEL" \
      --agree-tos --no-eff-email --non-interactive \
      || mourir "Émission du certificat échouée.
   Vérifiez que http://$DOMAINE/.well-known/acme-challenge/ est joignable
   DEPUIS INTERNET (pare-feu OVH, groupe de sécurité, ufw)."
  else
    echo "  émission en mode autonome (nginx n'est pas démarré)"
    docker run --rm -p 80:80 \
      -v /etc/letsencrypt:/etc/letsencrypt \
      certbot/certbot certonly --standalone \
      -d "$DOMAINE" --email "$COURRIEL" \
      --agree-tos --no-eff-email --non-interactive \
      || mourir "Émission du certificat échouée.
   Le port 80 doit être joignable depuis Internet."
  fi
  vert "  ✓ certificat obtenu"
else
  RESTE=$(( ( $(date -d "$(openssl x509 -in "$CERT_LE" -noout -enddate | cut -d= -f2)" +%s) - $(date +%s) ) / 86400 ))
  vert "  ✓ certificat déjà valide ($RESTE jours restants) — non redemandé"
fi

# nginx lit /etc/ssl/maintrix.crt et .key (montés depuis ./ssl). On COPIE plutôt
# qu'on ne lie : /etc/letsencrypt/live/ ne contient que des liens symboliques
# vers ../../archive/, qui pointeraient dans le vide à l'intérieur du conteneur.
install -m 644 "$CERT_LE" "$RACINE/ssl/maintrix.crt"
install -m 600 "$CLE_LE"  "$RACINE/ssl/maintrix.key"
vert "  ✓ certificat installé dans ssl/ (émetteur : $(openssl x509 -in "$RACINE/ssl/maintrix.crt" -noout -issuer | sed 's/.*CN *= *//'))"

# ═══════════════════════════════════════════════════════════════════
titre "3/5 — Provisionnement de l'environnement"

command -v node >/dev/null 2>&1 || mourir "Node.js absent. Voir docs/DEPLOY_OVH.md, étape 2."
[ -d node_modules ] || { echo "  installation des dépendances…"; npm ci --silent; }

node scripts/provision-test-env.mjs --public-url="https://$DOMAINE"

# Le provisionnement écrit ALLOWED_ORIGINS ; l'application doit être relancée
# pour la lire. Sans cela : 403 ORIGIN_NOT_ALLOWED à chaque connexion.
"${COMPOSE[@]}" up -d app nginx
vert "  ✓ application et nginx relancés avec le domaine public"

# ═══════════════════════════════════════════════════════════════════
titre "4/5 — Renouvellement automatique du certificat"

# Un certificat Let's Encrypt vit 90 jours. Sans renouvellement, le site devient
# inaccessible aux testeurs du jour au lendemain, sur une erreur de certificat
# expiré — panne d'autant plus déroutante que rien d'autre n'aura changé.
cat > /etc/cron.weekly/maintrix-renouveler-cert <<CRON
#!/bin/sh
# Renouvellement du certificat de $DOMAINE — installé par scripts/deploy-ovh.sh
# Ne fait rien tant qu'il reste plus de 30 jours de validité.
cd "$RACINE" || exit 0
docker run --rm \\
  -v /etc/letsencrypt:/etc/letsencrypt \\
  -v "$RACINE/certbot-webroot:/var/www/certbot" \\
  certbot/certbot renew --webroot -w /var/www/certbot --quiet || exit 1

# Recopier puis recharger : nginx ne relit pas les certificats tout seul.
install -m 644 "$CERT_LE" "$RACINE/ssl/maintrix.crt"
install -m 600 "$CLE_LE"  "$RACINE/ssl/maintrix.key"
docker exec maintrix-test-nginx nginx -s reload 2>/dev/null || true
CRON
chmod +x /etc/cron.weekly/maintrix-renouveler-cert
vert "  ✓ /etc/cron.weekly/maintrix-renouveler-cert installé"
echo "     (renouvelle sous 30 jours de validité, recopie le certificat, recharge nginx)"

# ═══════════════════════════════════════════════════════════════════
titre "5/5 — Porte d'ouverture"

sleep 10
if node scripts/verify-opening.mjs; then
  echo
  vert "═══════════════════════════════════════════════════════════"
  vert "  ENVIRONNEMENT DE TEST OUVERT"
  vert "═══════════════════════════════════════════════════════════"
  echo
  echo "  Adresse testeurs   https://$DOMAINE/"
  echo "  Identifiants       .env.test-cloud (jamais versionné)"
  echo "  Provisionner       docs/TESTER_ONBOARDING.md"
  echo "  Fermer l'accès     docker stop maintrix-test-nginx"
  echo
else
  echo
  jaune "La porte d'ouverture a relevé des points bloquants — voir ci-dessus."
  jaune "L'environnement tourne, mais ne l'annoncez pas encore aux testeurs."
  exit 1
fi
