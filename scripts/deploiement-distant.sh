#!/usr/bin/env bash
#
# Exécuté SUR LE SERVEUR par la CI (.github/workflows/deploy-ovh.yml), via SSH.
# Ne contient aucune logique de déploiement propre : il amène le dépôt du
# serveur sur le commit validé par la CI, puis délègue à scripts/deploy-ovh.sh.
#
# Variables attendues : COMMIT, DOMAINE, COURRIEL ; DOSSIER (facultatif).
set -euo pipefail

: "${COMMIT:?COMMIT requis}"
: "${DOMAINE:?DOMAINE requis}"
: "${COURRIEL:?COURRIEL requis}"
DOSSIER="${DOSSIER:-/opt/maintrix-git}"

cd "$DOSSIER"
git fetch --quiet origin

# Seul un commit déjà présent sur main peut être déployé.
git merge-base --is-ancestor "$COMMIT" origin/main \
  || { echo "⛔ $COMMIT n'appartient pas à origin/main — refus"; exit 1; }

# Aucune modification locale ne doit être écrasée ni déployée par accident.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "⛔ modifications locales non commitées sur le serveur — refus"
  git status --short --untracked-files=no
  exit 1
fi

git checkout --quiet main
git merge --quiet --ff-only "$COMMIT"
echo "dépôt du serveur au commit $(git rev-parse --short HEAD)"

# -n : échoue immédiatement si sudo exige un mot de passe, au lieu d'attendre.
sudo -n bash scripts/deploy-ovh.sh "$DOMAINE" "$COURRIEL"
