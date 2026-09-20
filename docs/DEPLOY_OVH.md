# Déployer l'environnement de test sur OVHcloud Public Cloud

Objectif : passer de « ça tourne sur mon poste » à **`https://maintrix-test.techlearn-saem.com`**,
joignable par des testeurs externes, avec un vrai certificat.

Une fois l'instance créée et le DNS posé (étapes 1 et 3), tout le reste tient en
une commande :

```bash
sudo bash scripts/deploy-ovh.sh maintrix-test.techlearn-saem.com vous@techlearn-saem.com
```

---

## Étape 1 — Créer l'instance

Espace client OVHcloud → **Public Cloud** → votre projet → **Instances** →
*Créer une instance*.

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Modèle | **D2-4** (2 vCPU, 4 Go) minimum — **B2-7** (2 vCPU, 7 Go) confortable | la construction de l'image (Vite + esbuild) est le moment le plus gourmand ; en dessous de 4 Go elle échoue par manque de mémoire |
| Image | **Ubuntu 24.04** | Docker et Node y sont directement disponibles |
| Disque | **40 Go** minimum | l'image applicative pèse 2,6 Go, plus les couches de construction et les données PostgreSQL |
| Région | **GRA / SBG / DE** | proche de vos testeurs |
| Clé SSH | ajoutez la vôtre | OVH n'envoie pas de mot de passe root pour Public Cloud |

> **Si vous prenez 4 Go**, ajoutez du swap avant la première construction, sinon
> elle peut être tuée par le noyau :
> ```bash
> sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
> sudo mkswap /swapfile && sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

Notez l'**IP publique** affichée à la fin.

---

## Étape 2 — Préparer le serveur

```bash
ssh ubuntu@<IP-publique>
```

```bash
sudo apt update && sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc >/dev/null
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

Node.js 20 (indispensable : les scripts de provisionnement tournent sur l'hôte) :

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**Aucun serveur web ne doit occuper les ports 80 et 443** — nginx tourne dans un
conteneur :

```bash
sudo systemctl disable --now apache2 nginx 2>/dev/null || true
```

### Pare-feu

Deux niveaux à vérifier, l'oubli de l'un est la cause la plus fréquente d'un
« ça ne répond pas » inexplicable :

```bash
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw --force enable
```

Côté OVH, si vous avez attaché un **groupe de sécurité** à l'instance
(Public Cloud → Network → Security groups), autorisez-y aussi 22, 80 et 443 en
entrée. Un groupe restrictif bloque avant même que le paquet n'atteigne `ufw`.

**PostgreSQL n'est jamais exposé** : il n'a aucun port publié, et l'application
n'écoute que sur la boucle locale. Seul nginx est joignable.

---

## Étape 3 — Pointer le domaine

Dans la zone DNS de `techlearn-saem.com`, créez :

| Type | Sous-domaine | Cible |
|---|---|---|
| **A** | `maintrix-test` | l'IP publique de l'instance |

> ### ⚠️ Votre domaine passe par Cloudflare
>
> Mesuré : `techlearn-saem.com` résout vers `188.114.96.2` et `188.114.97.2` —
> des adresses Cloudflare, pas votre hébergement. Vos enregistrements sont donc
> gérés là-bas, et non dans la zone OVH.
>
> **Créez l'enregistrement dans Cloudflare, en mode « DNS only » (nuage gris),
> pas « Proxied » (nuage orange).** Avec le proxy actif, Let's Encrypt valide
> Cloudflare et non votre instance : l'émission du certificat échoue, et le
> déploiement s'arrête à l'étape 2 du script.

Vérifiez la propagation depuis le serveur :

```bash
getent ahostsv4 maintrix-test.techlearn-saem.com
curl -s https://api.ipify.org   # doit afficher la même adresse
```

Le script refuse de continuer si les deux diffèrent — il vaut mieux un refus
clair qu'un échec de certificat obscur.

---

## Étape 4 — Déployer

```bash
git clone https://github.com/Gisele83/Maintrix.git
cd Maintrix
sudo bash scripts/deploy-ovh.sh maintrix-test.techlearn-saem.com vous@techlearn-saem.com
```

Le script enchaîne, et **s'arrête au premier échec** :

1. **Prérequis** — Docker, Node, GnuPG, ports 80/443 libres, DNS pointant vers
   *cette* machine, aucune modification locale non commitée, inventaire des
   volumes.
2. **Certificat** — Let's Encrypt, puis installation dans `ssl/`.
3. **Sauvegarde chiffrée** — base, fichiers téléversés et secrets, chiffrés en
   AES-256 (`scripts/sauvegarde-chiffree.sh`), puis relus et déchiffrés pour
   preuve.
4. **Restauration vérifiée** — la sauvegarde est restaurée dans une base
   PostgreSQL **isolée** (conteneur jetable, en mémoire, sans volume, sans port
   public). Le nombre de lignes de chaque table y est comparé à l'original, puis
   le **nouveau schéma est appliqué sur cette copie** : si une seule colonne
   disparaît ou si un seul décompte change, le déploiement est interrompu
   avant d'avoir touché la vraie base (`scripts/restauration-verifiee.sh`).
5. **Mise à jour** — image construite, schéma appliqué, comptes de
   démonstration retirés, compte de sonde aligné, application redémarrée.
6. **Renouvellement** — tâche hebdomadaire installée.
7. **Porte d'ouverture** — `verify-opening.mjs`.

Si l'étape 5 ou 7 échoue, l'image précédente est **remise en service
automatiquement** et le chemin de la sauvegarde est affiché. Le schéma n'est pas
retourné : il a été prouvé sans perte à l'étape 4. Les volumes sont recensés
avant et après ; la disparition d'un seul est signalée comme un échec.

### Données des testeurs : ce qui les protège

| Garantie | Mécanisme |
|---|---|
| Volumes à noms permanents | `docker-compose.test.yml` : `name:` + `external: true`. `docker compose down -v` ne les supprime pas. |
| Aucune suppression de volume | `provision-test-env.mjs --down` n'utilise plus `-v` ; `--reset` est supprimé. |
| Sauvegarde avant chaque mise à jour | étape 3, obligatoire — pas d'option pour la sauter. |
| Schéma sans perte | `drizzle-kit push --force` supprime sans prévenir les colonnes retirées du schéma (mesuré). Il n'est appliqué à la vraie base qu'après l'avoir été sur la copie restaurée **pour ce même commit**. Lancé à la main hors de cette procédure, le provisionnement refuse de toucher une base existante. |
| Pas de comptes à mot de passe public | `admin@maintrix.local`, `tech@maintrix.local`, `admin-beta@maintrix.local` sont retirés à chaque déploiement. Les contrôles utilisent un **compte de sonde** dédié (technicien, locataire vide, mot de passe aléatoire dans `.env.test-cloud`). |

> ⚠️ **La clé de chiffrement** est créée au premier passage dans
> `/etc/maintrix/cle-sauvegarde`. **Copiez-la hors du serveur** (gestionnaire
> de mots de passe) : sans elle, les sauvegardes sont illisibles. Et une
> sauvegarde conservée sur le même serveur ne protège pas contre la perte du
> serveur : copiez régulièrement `/var/backups/maintrix/` ailleurs.
>
> Il n'y a pas de MinIO dans ce projet : les fichiers téléversés sont écrits
> sur disque (multer), dans le volume `maintrix-test_test_uploads`, qui est
> sauvegardé et verrouillé comme la base.

Comptez **10 à 20 minutes** à la première exécution, l'essentiel étant la
construction de l'image. Le script est **relançable** sans rien casser : un
certificat encore valide n'est pas redemandé (Let's Encrypt plafonne à
5 certificats par domaine et par semaine).

Attendu en fin d'exécution :

```
  OUVERTURE : AUTORISÉE   —   17 réussis, 0 échoués, 0 réserve(s)
```

Les deux réserves de la phase 12 — adresse privée, certificat auto-signé —
tombent d'elles-mêmes : l'adresse devient publique et le certificat est signé
par Let's Encrypt.

---

## Étape 5 — Ouvrir aux testeurs

Créez un compte par testeur — voir [TESTER_ONBOARDING.md](TESTER_ONBOARDING.md).
Les identifiants du super-admin sont dans `.env.test-cloud` sur le serveur
(fichier jamais versionné) :

```bash
grep SUPER_ADMIN .env.test-cloud
```

**Commencez par deux ou trois testeurs.** Les défauts qui comptent apparaissent
dès les premiers parcours, et un incident sur trois personnes se gère.

Conduite de session, observation et arrêt d'urgence :
[CONTROLLED_OPENING.md](CONTROLLED_OPENING.md).

---

## Exploiter

```bash
docker compose --env-file .env.test-cloud -f docker-compose.test.yml -p maintrix-test logs -f app
curl -s https://maintrix-test.techlearn-saem.com/api/health
node scripts/verify-opening.mjs        # avant chaque session
```

| Besoin | Commande |
|---|---|
| Fermer l'accès immédiatement | `docker stop maintrix-test-nginx` |
| Rouvrir | `docker start maintrix-test-nginx` |
| Sauvegarder maintenant | `sudo bash scripts/sauvegarde-chiffree.sh` |
| Éprouver une sauvegarde | `sudo bash scripts/restauration-verifiee.sh` (la plus récente, dans une base isolée) |
| Arrêter la stack | `node scripts/provision-test-env.mjs --down` — volumes et données conservés |
| Mettre à jour le code | voir « Mettre à jour » ci-dessous |

### Mettre à jour

**Par la CI (recommandé).** Chaque commit de `main` validé par « CI - Build &
Test » est déployé par `.github/workflows/deploy-ovh.yml`, qui se connecte en
SSH et lance **la même procédure** (`scripts/deploiement-distant.sh` →
`deploy-ovh.sh`). Aucun raccourci : sauvegarde, restauration vérifiée,
interruption automatique.

À configurer une fois, dans *Settings → Secrets and variables → Actions* :

| Type | Nom | Valeur |
|---|---|---|
| secret | `OVH_SSH_CLE_PRIVEE` | clé privée d'une paire **dédiée** au déploiement |
| secret | `OVH_SSH_HOTES_CONNUS` | `ssh-keyscan 57.130.11.84`, **vérifiée** contre l'empreinte affichée sur le serveur (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`) |
| variable | `OVH_HOTE` | `57.130.11.84` |
| variable | `OVH_UTILISATEUR` | `ubuntu` (défaut) |
| variable | `OVH_DOSSIER` | `/opt/maintrix-git` (défaut) |
| variable | `DEPLOIEMENT_DOMAINE` | `maintrix-test.techlearn-saem.com` |
| variable | `DEPLOIEMENT_COURRIEL` | adresse pour Let's Encrypt |

Puis *Settings → Environments → New environment* « `test-en-ligne` », avec
**Required reviewers** : chaque déploiement attend alors votre validation.
Tant que la configuration manque, le workflow se termine sur un avertissement,
sans rien tenter.

Côté serveur, la clé publique est ajoutée à `~ubuntu/.ssh/authorized_keys`, et
l'utilisateur doit pouvoir lancer `sudo` sans mot de passe (c'est le cas par
défaut sur les images Ubuntu d'OVH).

**À la main.**

```bash
cd /opt/maintrix-git
git fetch origin
git status --porcelain --untracked-files=no   # doit être vide
git checkout main && git merge --ff-only origin/main
sudo bash scripts/deploy-ovh.sh maintrix-test.techlearn-saem.com vous@techlearn-saem.com
```

Faites-le **hors session de test** : la reconstruction de l'image et le
redémarrage coupent le service quelques minutes.

### Restaurer une sauvegarde sur la vraie base

Rien ne le fait automatiquement : c'est une décision d'exploitant. La
sauvegarde choisie est d'abord éprouvée, puis restaurée :

```bash
sudo bash scripts/restauration-verifiee.sh /var/backups/maintrix/<horodatage>
```

La commande de restauration effective est affichée dans le manifeste de la
sauvegarde (`manifeste.txt`).

### Le certificat

Il vit 90 jours. `/etc/cron.weekly/maintrix-renouveler-cert`, installé par le
script, le renouvelle sous 30 jours de validité, recopie les fichiers dans
`ssl/` et recharge nginx.

Pour vérifier que le mécanisme fonctionne **avant** d'en dépendre :

```bash
sudo /etc/cron.weekly/maintrix-renouveler-cert && echo "renouvellement OK"
```

Le renouvellement passe par `/.well-known/acme-challenge/`, servi en clair par
nginx. Ce chemin a dû être ajouté explicitement : le bloc HTTP redirigeait
**tout** vers HTTPS, y compris le défi — le premier certificat s'obtenait, puis
le renouvellement échouait en silence, et le site devenait inaccessible
90 jours plus tard sur une erreur de certificat expiré.

---

## Si quelque chose bloque

| Symptôme | Cause la plus probable |
|---|---|
| `ne résout vers aucune adresse IPv4` | enregistrement A absent ou non propagé |
| `pointe vers 188.114.x.x` | proxy Cloudflare actif — passez le sous-domaine en « DNS only » |
| `Le port 80 est occupé` | apache2 ou nginx système actif : `sudo systemctl disable --now apache2 nginx` |
| Émission du certificat échouée | port 80 fermé côté pare-feu OVH **ou** `ufw` |
| Construction tuée sans message | mémoire insuffisante — ajoutez du swap (étape 1) |
| `403 ORIGIN_NOT_ALLOWED` à la connexion | l'application n'a pas été relancée après changement du domaine : `docker compose … up -d app` |

---

## Ce que ce déploiement ne couvre pas

- **Une seule instance.** Sessions, limiteur de débit et tâches de fond vivent en
  mémoire — voir [SINGLE_INSTANCE_ASSUMPTION.md](SINGLE_INSTANCE_ASSUMPTION.md).
  Ne lancez pas deux exemplaires derrière un répartiteur de charge.
- **Sauvegardes sur le même serveur.** Chaque mise à jour en produit une, mais
  elle disparaîtrait avec l'instance. Copiez `/var/backups/maintrix/` et la clé
  hors du serveur, ou activez les sauvegardes automatiques de l'instance
  côté OVH.
- **Pas de sauvegarde planifiée entre deux mises à jour.** Pour une sauvegarde
  quotidienne : `sudo ln -s /opt/maintrix-git/scripts/sauvegarde-chiffree.sh /etc/cron.daily/maintrix-sauvegarde`.
- **Aucune supervision externe.** `/api/health` est public et sans donnée
  sensible : branchez-y un service de surveillance si les sessions s'étalent.

---

## Ce que promet la bannière « Version de test »

Les pages publiques affichent : « les données saisies pendant les tests sont
conservées lors du passage en production ». Cette phrase engage. Elle est tenue
par la procédure décrite plus haut, à une condition près.

**Ce qui la garantit :**

- volumes à noms permanents, déclarés `external` — aucune commande du projet ne
  les supprime, et `--reset` n'existe plus ;
- sauvegarde chiffrée obligatoire avant chaque mise à jour ;
- schéma éprouvé sur une copie restaurée : un changement qui supprimerait une
  colonne ou des lignes interrompt le déploiement ;
- comptes et données conservés d'une version à l'autre : la base de test EST
  celle qui passera en production.

**La condition :** la production doit rester **cette instance**, avec ces
volumes. Si vous décidez un jour de produire sur une autre machine, les données
ne suivent pas toutes seules — il faut y restaurer une sauvegarde :

```bash
sudo bash scripts/restauration-verifiee.sh /var/backups/maintrix/<horodatage>
```

Si cette condition ne peut pas être tenue, retirez la phrase des pages
publiques plutôt que de la laisser promettre à votre place :
`client/src/pages/landing.tsx` et `client/src/pages/login.tsx`.
