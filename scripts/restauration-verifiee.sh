#!/usr/bin/env bash
#
# Restauration VÉRIFIÉE dans une base ISOLÉE — obligatoire avant tout
# déploiement sur une base existante. Appelée par scripts/deploy-ovh.sh :
#
#   sudo bash scripts/restauration-verifiee.sh [dossier-de-sauvegarde]
#
# Sans argument, vérifie la dernière sauvegarde.
#
# ═══════════════════════════════════════════════════════════════════
# CE QUI EST PROUVÉ, DANS L'ORDRE
# ═══════════════════════════════════════════════════════════════════
#   1. les fichiers n'ont pas été altérés (empreintes SHA-256 du manifeste) ;
#   2. la sauvegarde se déchiffre avec la clé du serveur ;
#   3. elle se restaure intégralement dans une base PostgreSQL neuve ;
#   4. la copie contient exactement le nombre de lignes de chaque table
#      relevé au moment de la sauvegarde ;
#   5. le schéma du code à déployer s'applique SUR CETTE COPIE sans supprimer
#      aucune colonne ni aucune ligne.
#
# Le point 5 est le garde-fou des données des testeurs : `drizzle-kit push
# --force` accepte sans confirmation les opérations destructrices. Mesuré le
# 2026-09-15 : une colonne retirée du schéma disparaît avec ses données. Et sans
# `--force`, la commande échoue… en renvoyant le code 0. On ne se fie donc ni à
# l'option ni au code de retour : on applique le schéma sur une copie, et on
# compare ce qui existe avant et après.
#
# ═══════════════════════════════════════════════════════════════════
# ISOLEMENT
# ═══════════════════════════════════════════════════════════════════
# La base d'essai est un conteneur jetable, hors du réseau de l'application,
# joignable seulement depuis la boucle locale de l'hôte, avec un mot de passe
# tiré au hasard. Ses données vivent en mémoire (tmpfs) : aucun volume Docker
# n'est créé, donc aucun n'est supprimé.
set -euo pipefail
umask 077

cd "$(dirname "$0")/.."
ENV_FILE="${MAINTRIX_TEST_ENV_FILE:-.env.test-cloud}"
DOSSIER="${MAINTRIX_DOSSIER_SAUVEGARDES:-/var/backups/maintrix}"
CLE="${MAINTRIX_CLE_SAUVEGARDE:-/etc/maintrix/cle-sauvegarde}"
TAILLE_ESSAI="${MAINTRIX_TAILLE_BASE_ESSAI:-4g}"
CONTENEUR="maintrix-restauration-essai"

rouge()  { printf '\033[31m%s\033[0m\n' "$*"; }
vert()   { printf '\033[32m%s\033[0m\n' "$*"; }
jaune()  { printf '\033[33m%s\033[0m\n' "$*"; }
mourir() { rouge "⛔ RESTAURATION NON VÉRIFIÉE : $*" >&2; exit 1; }

SAUVEGARDE="${1:-$(cat "$DOSSIER/derniere" 2>/dev/null || true)}"
[ -n "$SAUVEGARDE" ] && [ -d "$SAUVEGARDE" ] || mourir "aucune sauvegarde à vérifier"
[ -s "$CLE" ] || mourir "clé de chiffrement absente : $CLE"
[ -x node_modules/.bin/drizzle-kit ] || mourir "dépendances absentes : npm ci"

lire_env() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- || true; }
PG_USER="$(lire_env POSTGRES_USER)"; PG_USER="${PG_USER:-maintrix_test}"
PG_DB="$(lire_env POSTGRES_DB)";     PG_DB="${PG_DB:-maintrix_test}"

TMP="$(mktemp -d)"
nettoyer() {
  docker rm -f "$CONTENEUR" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap nettoyer EXIT

echo "  sauvegarde vérifiée : $SAUVEGARDE"

# ── 1. Intégrité ───────────────────────────────────────────────────
# Deux espaces (mode texte) ou « * » (mode binaire, sha256sum sous Windows).
(cd "$SAUVEGARDE" && grep -E '^[0-9a-f]{64} [ *]' manifeste.txt | sha256sum --quiet -c -) \
  || mourir "empreintes SHA-256 non conformes : fichiers altérés ou incomplets"
vert "  ✓ 1. empreintes conformes au manifeste"

# ── 2. Déchiffrement ───────────────────────────────────────────────
gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$CLE" \
    --decrypt "$SAUVEGARDE/base.dump.gpg" > "$TMP/base.dump" \
  || mourir "déchiffrement impossible avec la clé du serveur"
vert "  ✓ 2. sauvegarde déchiffrée"

# ── 3. Restauration dans une base neuve et isolée ──────────────────
MDP="$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)"
PORT="$(node -e "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})")"

docker rm -f "$CONTENEUR" >/dev/null 2>&1 || true
docker run -d --name "$CONTENEUR" \
  --label maintrix.role=restauration-essai \
  --tmpfs "/var/lib/postgresql/data:rw,size=$TAILLE_ESSAI" \
  -p "127.0.0.1:$PORT:5432" \
  -e POSTGRES_USER="$PG_USER" -e POSTGRES_DB="$PG_DB" -e POSTGRES_PASSWORD="$MDP" \
  postgres:15-alpine >/dev/null \
  || mourir "impossible de démarrer la base d'essai"

# L'image initialise la base puis REDÉMARRE le serveur : `pg_isready` répond
# pendant l'initialisation. On attend donc une vraie connexion TCP.
PRETE=non
for _ in $(seq 1 60); do
  if docker exec "$CONTENEUR" psql -h 127.0.0.1 -U "$PG_USER" -d "$PG_DB" -tAc 'SELECT 1' >/dev/null 2>&1; then
    PRETE=oui; break
  fi
  sleep 1
done
[ "$PRETE" = oui ] || mourir "la base d'essai n'a pas démarré"

docker cp "$TMP/base.dump" "$CONTENEUR:/tmp/base.dump" >/dev/null
docker exec "$CONTENEUR" pg_restore -h 127.0.0.1 -U "$PG_USER" -d "$PG_DB" \
    --no-owner --exit-on-error /tmp/base.dump > "$TMP/restauration.txt" 2>&1 \
  || { tail -20 "$TMP/restauration.txt" >&2; mourir "pg_restore a échoué"; }
vert "  ✓ 3. restaurée dans une base isolée (conteneur jetable, données en mémoire)"

# ── 4. Contenu identique à la sauvegarde ───────────────────────────
REQUETE_LIGNES="SELECT table_name || ' ' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
compter_copie() { docker exec "$CONTENEUR" psql -h 127.0.0.1 -U "$PG_USER" -d "$PG_DB" -tAc "$REQUETE_LIGNES"; }

compter_copie > "$TMP/lignes-copie.txt"
if ! diff -q "$SAUVEGARDE/lignes-par-table.txt" "$TMP/lignes-copie.txt" >/dev/null; then
  diff "$SAUVEGARDE/lignes-par-table.txt" "$TMP/lignes-copie.txt" | head -20 >&2
  mourir "la copie restaurée ne contient pas les mêmes lignes que la base sauvegardée"
fi
vert "  ✓ 4. mêmes lignes, table par table ($(grep -c . "$TMP/lignes-copie.txt") tables, $(awk '{s+=$2} END {print s+0}' "$TMP/lignes-copie.txt") lignes)"

# ── 5. Le nouveau schéma, appliqué à la copie, ne détruit rien ─────
colonnes_copie() {
  docker exec "$CONTENEUR" psql -h 127.0.0.1 -U "$PG_USER" -d "$PG_DB" -tAc \
    "SELECT table_name || '.' || column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY 1"
}
colonnes_copie > "$TMP/colonnes-avant.txt"

DATABASE_URL="postgresql://$PG_USER:$MDP@127.0.0.1:$PORT/$PG_DB" NODE_ENV=production \
  node_modules/.bin/drizzle-kit push --force > "$TMP/schema.txt" 2>&1 \
  || { tail -20 "$TMP/schema.txt" >&2; mourir "l'application du schéma a échoué sur la copie"; }

# drizzle-kit peut échouer en renvoyant 0 : on lit sa sortie.
if grep -qE '^Error:|Interactive prompts require a TTY|\[✗\]' "$TMP/schema.txt"; then
  tail -20 "$TMP/schema.txt" >&2
  mourir "drizzle-kit a signalé une erreur (code de sortie 0 malgré tout)"
fi

colonnes_copie > "$TMP/colonnes-apres.txt"
SUPPRIMEES="$(comm -23 "$TMP/colonnes-avant.txt" "$TMP/colonnes-apres.txt")"
if [ -n "$SUPPRIMEES" ]; then
  printf '%s\n' "$SUPPRIMEES" | head -30 >&2
  mourir "le nouveau schéma SUPPRIMERAIT ces colonnes et leurs données. Déploiement refusé : écrivez une migration qui les conserve."
fi

compter_copie > "$TMP/lignes-apres-schema.txt"
PERTES="$(join "$TMP/lignes-copie.txt" "$TMP/lignes-apres-schema.txt" | awk '$2 != $3 {print $1 " : " $2 " → " $3}')"
if [ -n "$PERTES" ]; then
  printf '%s\n' "$PERTES" >&2
  mourir "le nouveau schéma modifierait le nombre de lignes de ces tables"
fi
AJOUTEES="$(comm -13 "$TMP/colonnes-avant.txt" "$TMP/colonnes-apres.txt" | grep -c . || true)"
vert "  ✓ 5. nouveau schéma appliqué à la copie : 0 colonne supprimée, 0 ligne perdue ($AJOUTEES colonne(s) ajoutée(s))"

# ── Attestation, lue par le provisionnement ────────────────────────
{
  echo "date=$(date -u +%Y%m%dT%H%M%SZ)"
  echo "commit=$(git rev-parse --short HEAD 2>/dev/null || echo inconnu)"
  echo "sauvegarde=$SAUVEGARDE"
} > "$SAUVEGARDE/restauration-verifiee.ok"

vert "  ✓ RESTAURATION VÉRIFIÉE — la base réelle peut être mise à jour"
