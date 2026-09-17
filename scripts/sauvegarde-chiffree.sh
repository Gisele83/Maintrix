#!/usr/bin/env bash
#
# Sauvegarde CHIFFRÉE de l'environnement Maintrix — obligatoire avant toute
# mise à jour. Appelée par scripts/deploy-ovh.sh ; utilisable seule :
#
#   sudo bash scripts/sauvegarde-chiffree.sh
#
# Produit un dossier daté contenant :
#   base.dump.gpg               la base PostgreSQL (pg_dump, format personnalisé)
#   televersements.tar.gz.gpg   les fichiers téléversés (volume des uploads)
#   environnement.gpg           le fichier de secrets
#   lignes-par-table.txt        le nombre de lignes de chaque table
#   manifeste.txt               empreintes SHA-256, commit, date
#
# ═══════════════════════════════════════════════════════════════════
# POURQUOI LES SECRETS SONT SAUVEGARDÉS AVEC LA BASE
# ═══════════════════════════════════════════════════════════════════
# Le fichier de secrets porte KMS_MASTER_KEY et MFA_ENCRYPTION_KEY. Sans eux,
# les données que l'application chiffre elle-même sont illisibles après
# restauration : une base restaurée sans ses clés n'est restaurée qu'à moitié.
#
# ═══════════════════════════════════════════════════════════════════
# LA CLÉ DE CHIFFREMENT
# ═══════════════════════════════════════════════════════════════════
# Créée au premier passage dans /etc/maintrix/cle-sauvegarde (root, 600).
# PERDRE CETTE CLÉ, C'EST PERDRE TOUTES LES SAUVEGARDES : copiez-la hors du
# serveur (gestionnaire de mots de passe) dès sa création.
#
# Chiffrement : GnuPG symétrique, AES-256, avec contrôle d'intégrité. Chaque
# fichier est redéchiffré à vide avant que la sauvegarde soit déclarée valide.
#
# ═══════════════════════════════════════════════════════════════════
# COHÉRENCE
# ═══════════════════════════════════════════════════════════════════
# Les lignes de chaque table sont comptées avant ET après le dump. Si des
# écritures ont eu lieu entre-temps, la sauvegarde est refaite (trois essais) :
# la restauration vérifiée compare ensuite la copie à ces comptes, qui doivent
# donc décrire exactement ce que contient le dump.
set -euo pipefail
umask 077

cd "$(dirname "$0")/.."
ENV_FILE="${MAINTRIX_TEST_ENV_FILE:-.env.test-cloud}"
DB="maintrix-test-db"
APP="maintrix-test-app"
VOLUME_TELEVERSEMENTS="maintrix-test_test_uploads"
DOSSIER="${MAINTRIX_DOSSIER_SAUVEGARDES:-/var/backups/maintrix}"
CLE="${MAINTRIX_CLE_SAUVEGARDE:-/etc/maintrix/cle-sauvegarde}"
CONSERVER="${MAINTRIX_SAUVEGARDES_CONSERVEES:-30}"

rouge()  { printf '\033[31m%s\033[0m\n' "$*"; }
vert()   { printf '\033[32m%s\033[0m\n' "$*"; }
jaune()  { printf '\033[33m%s\033[0m\n' "$*"; }
mourir() { rouge "⛔ $*" >&2; exit 1; }

command -v gpg >/dev/null 2>&1 || mourir "GnuPG absent : sudo apt install -y gnupg"
[ -f "$ENV_FILE" ] || mourir "$ENV_FILE absent — lancez depuis le dossier du dépôt"
[ "$(docker inspect -f '{{.State.Running}}' "$DB" 2>/dev/null || true)" = "true" ] \
  || mourir "la base $DB ne tourne pas : aucune sauvegarde cohérente possible"

lire_env() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- || true; }
PG_USER="$(lire_env POSTGRES_USER)"; PG_USER="${PG_USER:-maintrix_test}"
PG_DB="$(lire_env POSTGRES_DB)";     PG_DB="${PG_DB:-maintrix_test}"

# ── Clé ────────────────────────────────────────────────────────────
if [ ! -s "$CLE" ]; then
  mkdir -p "$(dirname "$CLE")"
  chmod 700 "$(dirname "$CLE")"
  head -c 48 /dev/urandom | base64 | tr -d '\n' > "$CLE"
  chmod 600 "$CLE"
  jaune "  ⚠ CLÉ DE CHIFFREMENT CRÉÉE : $CLE"
  jaune "    Copiez-la HORS du serveur maintenant. Sans elle, aucune sauvegarde n'est restaurable."
fi
case "$(uname -s)" in
  # NTFS n'a pas de modes POSIX : le contrôle ne peut y aboutir (poste de dev).
  MINGW*|MSYS*|CYGWIN*) jaune "  ⚠ Windows : permissions de $CLE non vérifiables" ;;
  *) [ "$(stat -c %a "$CLE")" = "600" ] || mourir "permissions de $CLE trop ouvertes (600 attendu)" ;;
esac

chiffrer() {
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$CLE" \
      --symmetric --cipher-algo AES256 --compress-algo none -o "$1"
}
dechiffrer_a_vide() {
  gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$CLE" --decrypt "$1" > /dev/null
}

# Nombre exact de lignes de chaque table, en une requête.
REQUETE_LIGNES="SELECT table_name || ' ' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
compter_lignes() { docker exec "$DB" psql -U "$PG_USER" -d "$PG_DB" -tAc "$REQUETE_LIGNES"; }

# ── Espace disponible ──────────────────────────────────────────────
# Une sauvegarde tronquée par un disque plein est pire qu'absente : elle
# paraît exister. On vérifie avant, et on refuse clairement.
mkdir -p "$DOSSIER"
MARGE_MO="${MAINTRIX_MARGE_SAUVEGARDE_MO:-2048}"
LIBRE_MO="$(df -BM --output=avail "$DOSSIER" 2>/dev/null | tail -1 | tr -dc '0-9')"
LIBRE_MO="${LIBRE_MO:-0}"
[ "$LIBRE_MO" -ge "$MARGE_MO" ] \
  || mourir "espace insuffisant dans $DOSSIER : ${LIBRE_MO} Mo libres, ${MARGE_MO} Mo attendus"

# ── Dossier daté ───────────────────────────────────────────────────
HORODATAGE="$(date -u +%Y%m%dT%H%M%SZ)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo inconnu)"
CIBLE="$DOSSIER/$HORODATAGE-$COMMIT"
mkdir -p "$CIBLE"
chmod 700 "$DOSSIER" "$CIBLE"
echo "  sauvegarde : $CIBLE"

# ── Base ───────────────────────────────────────────────────────────
for tentative in 1 2 3; do
  AVANT="$(compter_lignes)"
  docker exec "$DB" pg_dump -U "$PG_USER" -d "$PG_DB" -Fc --no-owner | chiffrer "$CIBLE/base.dump.gpg"
  APRES="$(compter_lignes)"
  if [ "$AVANT" = "$APRES" ]; then break; fi
  if [ "$tentative" = "3" ]; then
    mourir "la base a été modifiée pendant chaque tentative : sauvegarde non vérifiable. Relancez hors session de test."
  fi
  jaune "  écritures pendant la sauvegarde (tentative $tentative) — nouvel essai"
done
printf '%s\n' "$APRES" > "$CIBLE/lignes-par-table.txt"
[ -s "$CIBLE/base.dump.gpg" ] || mourir "dump vide"
vert "  ✓ base chiffrée ($(grep -c . "$CIBLE/lignes-par-table.txt") tables)"

# ── Fichiers téléversés ────────────────────────────────────────────
if docker volume inspect "$VOLUME_TELEVERSEMENTS" >/dev/null 2>&1; then
  if [ "$(docker inspect -f '{{.State.Running}}' "$APP" 2>/dev/null || true)" = "true" ]; then
    docker exec "$APP" tar -C /app/uploads -czf - . | chiffrer "$CIBLE/televersements.tar.gz.gpg"
  else
    docker run --rm -v "$VOLUME_TELEVERSEMENTS:/src:ro" alpine:3 tar -C /src -czf - . \
      | chiffrer "$CIBLE/televersements.tar.gz.gpg"
  fi
  vert "  ✓ fichiers téléversés chiffrés"
else
  jaune "  volume $VOLUME_TELEVERSEMENTS absent — aucun fichier téléversé à sauvegarder"
fi

# ── Secrets ────────────────────────────────────────────────────────
chiffrer "$CIBLE/environnement.gpg" < "$ENV_FILE"
vert "  ✓ fichier de secrets chiffré"

# ── Vérification : chaque fichier doit se redéchiffrer ─────────────
for f in "$CIBLE"/*.gpg; do
  dechiffrer_a_vide "$f" || mourir "déchiffrement impossible : $f — sauvegarde INVALIDE"
done
vert "  ✓ chaque fichier se redéchiffre avec la clé"

# ── Manifeste ──────────────────────────────────────────────────────
{
  echo "date=$HORODATAGE"
  echo "commit=$COMMIT"
  echo "base=$PG_DB"
  (cd "$CIBLE" && sha256sum ./*.gpg lignes-par-table.txt)
} > "$CIBLE/manifeste.txt"
printf '%s\n' "$CIBLE" > "$DOSSIER/derniere"

# ── Conservation ───────────────────────────────────────────────────
# Seuls d'anciens DOSSIERS DE SAUVEGARDE sont retirés ; aucun volume Docker.
ANCIENNES="$(find "$DOSSIER" -mindepth 1 -maxdepth 1 -type d | sort | head -n -"$CONSERVER" || true)"
if [ -n "$ANCIENNES" ]; then
  printf '%s\n' "$ANCIENNES" | xargs -r rm -rf
  jaune "  $(printf '%s\n' "$ANCIENNES" | grep -c .) ancienne(s) sauvegarde(s) retirée(s) (conservation : $CONSERVER)"
fi

vert "  ✓ SAUVEGARDE CHIFFRÉE VALIDE — $CIBLE"
